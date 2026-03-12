document.addEventListener('DOMContentLoaded', () => {
    // Get characters and roles from global window object
    const characters = window.characters;
    const characterRoles = window.characterRoles;

    let statsData = [];

    // Load actual stats from Firebase
    async function loadStats() {
        const db = window.db;
        const loadingIndicator = document.getElementById('loading-indicator');
        const characterList = document.getElementById('character-list');

        if (!db) {
            console.error("Firebase DB not initialized");
            loadingIndicator.innerHTML = "<p>Erreur: Impossible de se connecter à la base de données.</p>";
            return;
        }

        try {
            // 1. Get total matches (using a size aggregate or querying all. Using query snapshot size for simplicity on small datasets)
            const matchesSnap = await db.collection("matches").get();
            const totalMatches = matchesSnap.size;

            // We don't return if totalMatches === 0, we still display champions with "No Data".

            // 2. Get global champion stats (picks, bans)
            const champsSnap = await db.collection("champions").get();
            const champsData = {}; // { "Ahri": { picks: 5, bans: 2 } }
            champsSnap.forEach(doc => {
                champsData[doc.id] = doc.data();
            });

            // 3. Get all champion scores to calculate WinRate per role
            const scoresSnap = await db.collection("champion_scores").get();
            
            // Structure: { "Ahri": { "mid": { wins: 3, plays: 5 } } }
            const roleStats = {}; 
            
            scoresSnap.forEach(doc => {
                const data = doc.data();
                const champ = data.champion_id;
                const role = data.role && data.role.toUpperCase(); // Ensure it matches characterRoles format
                
                if(!roleStats[champ]) roleStats[champ] = {};
                if(!roleStats[champ][role]) roleStats[champ][role] = { wins: 0, plays: 0 };
                
                roleStats[champ][role].plays++;
                if(data.win) roleStats[champ][role].wins++;
            });

            // 4. Build the final statsData array
            characters.forEach(name => {
                const roles = characterRoles[name] || [];
                
                // Global stats for this champ
                const champInfo = champsData[name] || { picks: 0, bans: 0 };
                const globalPickRate = totalMatches > 0 ? ((champInfo.picks / totalMatches) * 100).toFixed(1) : 0;
                const globalBanRate = totalMatches > 0 ? ((champInfo.bans / totalMatches) * 100).toFixed(1) : 0;

                roles.forEach(role => {
                    // Role-specific stats
                    const roleData = (roleStats[name] && roleStats[name][role]) ? roleStats[name][role] : null;
                    
                    let winRate = 0;
                    if(roleData && roleData.plays > 0) {
                        winRate = ((roleData.wins / roleData.plays) * 100).toFixed(1);
                    }

                    // Dynamically calculate Tier based on WinRate for this specific role
                    let calculatedTier = "N/A";
                    let displayWinrate = "No Data";
                    const wr = parseFloat(winRate);
                    
                    if (roleData && roleData.plays > 0) {
                        if (wr >= 53) calculatedTier = "S";
                        else if (wr >= 50) calculatedTier = "A";
                        else if (wr >= 48) calculatedTier = "B";
                        else if (wr > 0) calculatedTier = "C"; // Played but bad winrate
                        else calculatedTier = "D"; // Played with 0% winrate
                        displayWinrate = winRate + '%';
                    }

                    statsData.push({
                        name: name,
                        image: `images/${name}.png`,
                        role: role,
                        tier: calculatedTier,
                        winrate: roleData && roleData.plays > 0 ? wr : -1, // Use -1 to sort "No Data" at the bottom
                        pickrate: parseFloat(globalPickRate),
                        banrate: parseFloat(globalBanRate),
                        displayWinrate: displayWinrate,
                        displayPickrate: globalPickRate > 0 ? globalPickRate + '%' : '0%',
                        displayBanrate: globalBanRate > 0 ? globalBanRate + '%' : '0%'
                    });
                });
            });

            // Remove loading indicator and trigger initial sort/render
            loadingIndicator.style.display = 'none';
            sortData();
            renderTable();

        } catch (error) {
            console.error("Error fetching stats:", error);
            loadingIndicator.innerHTML = "<p>Erreur lors du chargement des statistiques.</p>";
        }
    }

    let currentSort = { column: 'winrate', direction: 'desc' };
    let currentFilter = 'all';
    const characterList = document.getElementById('character-list');

    function sortData() {
        // Sort data
        statsData.sort((a, b) => {
            let valA = a[currentSort.column];
            let valB = b[currentSort.column];

            // Special handling for tier: customized sorting order S > A > B > C > D > N/A
            if (currentSort.column === 'tier') {
                const tierVal = { 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'N/A': 0 };
                valA = tierVal[valA] || 0;
                valB = tierVal[valB] || 0;
            }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;

            // Secondary sort by name if primary is tied
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
        });
    }

    function renderTable() {
        // Filter data
        let filteredData = statsData;
        if (currentFilter !== 'all') {
            filteredData = statsData.filter(stat => stat.role && stat.role.toLowerCase() === currentFilter);
        }

        // Clear existing rows
        characterList.innerHTML = '';

        filteredData.forEach((stat, index) => {
            const row = document.createElement('div');
            row.className = 'table-row clickable-row';
            row.onclick = () => {
                window.location.href = `character.html?champ=${encodeURIComponent(stat.name)}&role=${encodeURIComponent(stat.role)}`;
            };
            const tierClass = stat.tier !== 'N/A' ? `tier-${stat.tier.toLowerCase()}` : 'tier-na';
            // Disable animation delay if we are just sorting, or reduce it heavily to feel responsive
            row.style.animationDelay = `${(index % 15) * 0.02}s`;

            const roleHtml = stat.role ? `<span class="role-badge ${stat.role.toLowerCase()}">${stat.role}</span>` : '';

            row.innerHTML = `
                <div class="col-rank">${index + 1}</div>
                <div class="col-champ">
                    <img src="${stat.image}" alt="${stat.name}" class="champ-img" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\'><rect width=\\'40\\' height=\\'40\\' fill=\\'%23333\\'/></svg>'">
                    <span class="champ-name">${stat.name}</span>
                </div>
                <div class="col-role">${roleHtml}</div>
                <div class="col-tier"><span class="tier-badge ${stat.tier}">${stat.tier}</span></div>
                <div class="col-winrate">${stat.displayWinrate}</div>
                <div class="col-pickrate">${stat.displayPickrate}</div>
                <div class="col-banrate">${stat.displayBanrate}</div>
            `;

            characterList.appendChild(row);
        });
    }

    // Event listeners for filtering
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Set current filter and re-render
            currentFilter = btn.dataset.role;
            renderTable();
        });
    });

    // Event listeners for sorting headers
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;

            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'desc'; // default to descending for new sorts
            }

            // Update header UI
            document.querySelectorAll('.sortable').forEach(h => {
                h.classList.remove('active');
                const icon = h.querySelector('.sort-icon');
                if (icon) icon.className = 'sort-icon';
            });

            header.classList.add('active');
            const icon = header.querySelector('.sort-icon');
            if (icon) icon.classList.add(currentSort.direction);

            renderTable();
        });
    });

    // Initial render is now handled internally by loadStats() when it finishes fetching data
    // Call load on startup
    loadStats();
});
