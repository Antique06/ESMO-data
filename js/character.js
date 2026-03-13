document.addEventListener('DOMContentLoaded', async () => {
    const db = window.db;
    const characters = window.characters;
    const characterRoles = window.characterRoles;

    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const champParam = urlParams.get('champ');
    const roleParam = urlParams.get('role');

    const contentDiv = document.getElementById('dashboard-content');
    const loadingDiv = document.getElementById('loading-indicator');
    const errorDiv = document.getElementById('error-indicator');
    const errorMsg = document.getElementById('error-message');

    function showError(msg) {
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'none';
        errorDiv.style.display = 'block';
        errorMsg.textContent = msg;
    }

    if (!champParam || !roleParam) {
        showError("Paramètres de champion ou de rôle manquants dans l'URL.");
        return;
    }
    if (!db) {
        showError("Impossible de se connecter à la base de données Firebase.");
        return;
    }

    // Set Header Info
    document.getElementById('page-title').textContent = `Détails : ${champParam}`;
    document.getElementById('champ-name').textContent = champParam;
    document.getElementById('champ-role').textContent = roleParam;
    
    // Set Image with fallback
    const imgEl = document.getElementById('champ-img');
    const matchedChar = characters.find(c => c.toLowerCase() === champParam.toLowerCase());
    if (matchedChar) {
        imgEl.src = `images/${matchedChar}.png`;
        imgEl.onerror = () => { imgEl.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23333'/></svg>"; };
    }

    try {
        // 1. Fetch all scores for this champion in this role
        const scoresSnapshot = await db.collection("champion_scores")
            .where("champion_id", "==", champParam)
            .where("role", "==", roleParam.toLowerCase())
            .get();

        if (scoresSnapshot.empty) {
            showError(`Aucune donnée de match trouvée pour ${champParam} en ${roleParam}.`);
            return;
        }

        let totalWins = 0;
        let totalKills = 0;
        let totalDeaths = 0;
        let totalAssists = 0;
        const matchIds = [];

        // Global Stats Calculation
        scoresSnapshot.forEach(doc => {
            const data = doc.data();
            matchIds.push({ id: data.match_id, win: data.win });
            
            if (data.win) totalWins++;
            if (data.kda) {
                totalKills += (data.kda.kills || 0);
                totalDeaths += (data.kda.deaths || 0);
                totalAssists += (data.kda.assists || 0);
            }
        });

        const totalMatches = scoresSnapshot.size;
        const globalWinrate = ((totalWins / totalMatches) * 100).toFixed(1);
        
        const avgK = (totalKills / totalMatches).toFixed(1);
        const avgD = (totalDeaths / totalMatches).toFixed(1);
        const avgA = (totalAssists / totalMatches).toFixed(1);

        // Fetch global champion data for Pick/Ban Rates
        const matchesSnap = await db.collection("matches").get();
        const globalTotalMatches = matchesSnap.size;

        const champDoc = await db.collection("champions").doc(champParam).get();
        let globalPickRate = "0.0%";
        let globalBanRate = "0.0%";
        
        if (globalTotalMatches > 0 && champDoc.exists) {
            const data = champDoc.data();
            const p = data.picks || 0;
            const b = data.bans || 0;
            globalPickRate = ((p / globalTotalMatches) * 100).toFixed(1) + "%";
            globalBanRate = ((b / globalTotalMatches) * 100).toFixed(1) + "%";
        }

        // Update UI
        document.getElementById('global-matches').textContent = totalMatches;
        document.getElementById('global-pickrate').textContent = globalPickRate;
        document.getElementById('global-banrate').textContent = globalBanRate;
        
        const winrateEl = document.getElementById('global-winrate');
        winrateEl.textContent = `${globalWinrate}%`;
        if (globalWinrate >= 50) winrateEl.className = 'stat-value good';
        else winrateEl.className = 'stat-value bad';
        
        document.getElementById('global-kda').textContent = `${avgK} / ${avgD} / ${avgA}`;

        // 2. Complex Analysis: Matchups & Synergies
        const matchups = {}; // Enemy in same role. Key: EnemyChampName -> { wins: 0, total: 0 }
        const synergies = {}; // Allies in same team. Key: AlliedChampName -> { wins: 0, total: 0 }

        // Fetch the actual match documents to see the composition
        // Note: Firestore 'in' queries are limited to 10 items.
        // For larger data sets, we chunk the queries.
        const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const matchIdChunks = chunkArray(matchIds.map(m => m.id), 10);

        for (const chunk of matchIdChunks) {
            const matchesSnapshot = await db.collection("matches").where(firebase.firestore.FieldPath.documentId(), 'in', chunk).get();
            
            matchesSnapshot.forEach(doc => {
                const matchData = doc.data();
                // Find our target match context
                const scoreContext = matchIds.find(m => m.id === doc.id);
                if (!scoreContext) return;
                
                const isWin = scoreContext.win;
                const roleKey = roleParam.toLowerCase();

                // Determine which team the champion was on
                let myTeamKey = null;
                let enemyTeamKey = null;

                if (matchData.teams.team1[roleKey] && matchData.teams.team1[roleKey].champion === champParam) {
                    myTeamKey = 'team1';
                    enemyTeamKey = 'team2';
                } else if (matchData.teams.team2[roleKey] && matchData.teams.team2[roleKey].champion === champParam) {
                    myTeamKey = 'team2';
                    enemyTeamKey = 'team1';
                }

                if (myTeamKey && enemyTeamKey) {
                    // --- SYNERGIES (Same Team) ---
                    const myTeam = matchData.teams[myTeamKey];
                    Object.values(myTeam).forEach(pick => {
                        const allyChamp = pick.champion;
                        if (allyChamp && allyChamp !== champParam) { // Don't count self
                            if (!synergies[allyChamp]) synergies[allyChamp] = { wins: 0, total: 0 };
                            synergies[allyChamp].total++;
                            if (isWin) synergies[allyChamp].wins++;
                        }
                    });

                    // --- MATCHUPS (Enemy Team, Same Role) ---
                    const enemyRolePick = matchData.teams[enemyTeamKey][roleKey];
                    if (enemyRolePick && enemyRolePick.champion) {
                        const enemyChamp = enemyRolePick.champion;
                        if (!matchups[enemyChamp]) matchups[enemyChamp] = { wins: 0, total: 0 };
                        matchups[enemyChamp].total++;
                        if (isWin) matchups[enemyChamp].wins++; // Win for us means a win against them
                    }
                }
            });
        }

        // 3. Render Matchups and Synergies
        renderAnalysisList('matchups-container', matchups, true);
        renderAnalysisList('synergy-container', synergies, false);

        // Show Page
        loadingDiv.style.display = 'none';
        contentDiv.style.display = 'block';

    } catch (e) {
        console.error("Analysis Error:", e);
        showError("Erreur lors de l'analyse des données : " + e.message);
    }

    // Helper to generate HTML for the lists
    function renderAnalysisList(containerId, dataObj, isMatchup) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        // Convert dict to array and calculate winrate
        const arr = Object.keys(dataObj).map(champ => {
            const stats = dataObj[champ];
            return {
                champ: champ,
                total: stats.total,
                wins: stats.wins,
                winrate: ((stats.wins / stats.total) * 100)
            };
        });

        if (arr.length === 0) {
            container.innerHTML = `<div class="empty-state">Données insuffisantes...</div>`;
            return;
        }

        // Sort by winrate descending for Synergies, and usually ascending (hardest first) or descending for Matchups.
        // Let's sort by Total Games first for relevance, then Winrate
        arr.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total; // Most played against first
            return b.winrate - a.winrate;
        });

        // Take top 10 most relevant
        arr.slice(0, 10).forEach(item => {
            const wrFixed = item.winrate.toFixed(0);
            
            // For Matchups, a high winrate against them is GOOD. 
            // For Synergies, a high winrate with them is GOOD.
            let resultClass = 'neutral';
            if (item.winrate > 55) resultClass = 'win';
            else if (item.winrate < 45) resultClass = 'loss';

            // Safe image load
            const matchedC = characters.find(c => c.toLowerCase() === item.champ.toLowerCase());
            const imgSrc = matchedC ? `images/${matchedC}.png` : '';

            const row = document.createElement('div');
            row.className = 'matchup-row';
            row.innerHTML = `
                <div class="matchup-target">
                    <img src="${imgSrc}" alt="${item.champ}" class="target-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\'><rect width=\\'40\\' height=\\'40\\' fill=\\'%23333\\'/></svg>'">
                    <div>
                        <div class="target-name">${item.champ}</div>
                        <div class="target-details">${item.total} match${item.total > 1 ? 's' : ''} joués</div>
                    </div>
                </div>
                <div class="matchup-result">
                    <span class="result-text ${resultClass}">${wrFixed}%</span>
                    <div class="result-bar-container">
                        <div class="result-bar ${resultClass}" style="width: ${wrFixed}%"></div>
                    </div>
                </div>
            `;
            container.appendChild(row);
        });
    }
});
