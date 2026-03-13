document.addEventListener('DOMContentLoaded', () => {
    const db = window.db;
    const matchList = document.getElementById('match-list');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    // Pagination state
    let lastVisible = null;
    const matchesPerPage = 10;
    let matchesData = [];
    
    if (!db) {
        console.error("Firebase DB not initialized");
        loadingIndicator.innerHTML = "<p>Erreur: Impossible de se connecter à la base de données.</p>";
        return;
    }

    // Main load function
    async function loadMatches() {
        try {
            loadingIndicator.style.display = 'flex';
            matchList.innerHTML = '';
            
            // Query matches ordered by timestamp descending
            const matchesQuery = db.collection("matches")
                .orderBy("timestamp", "desc")
                .limit(50); // Hard limit for simple admin view to avoid huge reads
                
            const querySnapshot = await matchesQuery.get();
            matchesData = [];
            
            querySnapshot.forEach((doc) => {
                matchesData.push({ id: doc.id, ...doc.data() });
            });
            
            renderMatches();
            
        } catch (error) {
            console.error("Error loading matches:", error);
            loadingIndicator.innerHTML = "<p>Erreur lors du chargement des matchs.</p>";
        } finally {
            if(matchesData.length > 0) {
                loadingIndicator.style.display = 'none';
            } else {
                loadingIndicator.innerHTML = "<p>Aucun match trouvé.</p>";
            }
        }
    }

    function renderMatches() {
        matchList.innerHTML = '';
        
        matchesData.forEach((match) => {
            const row = document.createElement('div');
            row.className = 'table-row';
            row.id = `match-${match.id}`;
            
            // Format Date
            let dateStr = "Date inconnue";
            if (match.timestamp && match.timestamp.toDate) {
                const date = match.timestamp.toDate();
                dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
            }
            
            // Winner formatted
            let winnerStr = match.winner === 'team1' ? '<span class="winner-team1">Équipe 1</span>' : '<span class="winner-team2">Équipe 2</span>';
            
            // Extract Team 1 Champs
            let team1Html = '';
            if (match.teams && match.teams.team1) {
                Object.values(match.teams.team1).forEach(pick => {
                    if (pick.champion) {
                        team1Html += `<img src="images/${pick.champion}.png" class="champ-mini-icon" alt="${pick.champion}" title="${pick.champion}">`;
                    }
                });
            }
            
            // Extract Team 2 Champs
            let team2Html = '';
            if (match.teams && match.teams.team2) {
                Object.values(match.teams.team2).forEach(pick => {
                    if (pick.champion) {
                        team2Html += `<img src="images/${pick.champion}.png" class="champ-mini-icon" alt="${pick.champion}" title="${pick.champion}">`;
                    }
                });
            }

            row.innerHTML = `
                <div class="col-date">${dateStr}</div>
                <div class="col-winner">${winnerStr}</div>
                <div class="col-team1">${team1Html}</div>
                <div class="col-team2">${team2Html}</div>
                <div class="col-actions">
                    <button class="btn-delete" data-id="${match.id}">Supprimer</button>
                </div>
            `;
            
            matchList.appendChild(row);
        });
        
        // Attach delete listeners
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', handleDeleteClick);
        });
    }

    async function handleDeleteClick(e) {
        const btn = e.currentTarget;
        const matchId = btn.dataset.id;
        
        if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement ce match et toutes les statistiques associées ?")) {
            return;
        }
        
        // Visual feedback
        const originalText = btn.innerHTML;
        btn.innerHTML = '<div class="spinner-small"></div>';
        btn.disabled = true;
        
        try {
            await deleteMatchCascade(matchId);
            
            // Remove from UI
            const row = document.getElementById(`match-${matchId}`);
            if (row) {
                row.remove();
            }
            
            // Remove from local data array
            matchesData = matchesData.filter(m => m.id !== matchId);
            
            if (matchesData.length === 0) {
                loadingIndicator.style.display = 'flex';
                loadingIndicator.innerHTML = "<p>Aucun match trouvé.</p>";
            }
            
        } catch (error) {
            console.error("Error during deletion:", error);
            alert("Erreur lors de la suppression : " + error.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // Core Deletion Logic (Batch Transaction)
    async function deleteMatchCascade(matchId) {
        // 1. Get the match data to know which champions to decrement
        const matchRef = db.collection("matches").doc(matchId);
        const matchDoc = await matchRef.get();
        
        if (!matchDoc.exists) {
            throw new Error("Match introuvable");
        }
        
        const matchData = matchDoc.data();
        const batch = db.batch();
        
        // --- 2. Build map of stats to decrement ---
        const champStatUpdates = {}; // { "Ahri": { picks: -1, bans: -2 } }
        
        const trackStat = (champ, type) => {
            if (!champ) return;
            if (!champStatUpdates[champ]) champStatUpdates[champ] = { picks: 0, bans: 0 };
            champStatUpdates[champ][type] -= 1; // Negative for increment() function
        };

        // Track bans
        if (matchData.bans) {
            if (matchData.bans.team1) matchData.bans.team1.forEach(c => trackStat(c, 'bans'));
            if (matchData.bans.team2) matchData.bans.team2.forEach(c => trackStat(c, 'bans'));
        }
        
        // Track picks
        if (matchData.teams) {
            ['team1', 'team2'].forEach(team => {
                if(matchData.teams[team]) {
                    Object.values(matchData.teams[team]).forEach(pick => {
                        trackStat(pick.champion, 'picks');
                    });
                }
            });
        }

        // Apply stat updates to batch
        for (const [champName, stats] of Object.entries(champStatUpdates)) {
            const champRef = db.collection("champions").doc(champName);
            const updates = {};
            if (stats.picks !== 0) updates.picks = firebase.firestore.FieldValue.increment(stats.picks);
            if (stats.bans !== 0) updates.bans = firebase.firestore.FieldValue.increment(stats.bans);
            
            if (Object.keys(updates).length > 0) {
                batch.set(champRef, updates, { merge: true });
            }
        }

        // --- 3. Delete Champion Scores related to this match ---
        const scoresQuery = db.collection("champion_scores").where("match_id", "==", matchId);
        const scoresSnap = await scoresQuery.get();
        scoresSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // --- 4. Delete the match document itself ---
        batch.delete(matchRef);

        // --- 5. Commit the batch ---
        await batch.commit();
    }

    // Initialize
    loadMatches();
});
