document.addEventListener('DOMContentLoaded', () => {
    const characters = window.characters;
    const db = window.db;

    const roles = ["Top", "Jungle", "Mid", "Bot", "Support"];
    const characterRoles = window.characterRoles;

    // Create empty datalist containers
    const banDatalist = document.createElement('datalist');
    banDatalist.id = 'characters-list';
    document.body.appendChild(banDatalist);

    roles.forEach(role => {
        const roleDatalist = document.createElement('datalist');
        roleDatalist.id = `characters-list-${role.toLowerCase()}`;
        document.body.appendChild(roleDatalist);
    });

    const tabIndexMap = {
        't1_top_champ': 1, 't1_jungle_champ': 2, 't1_mid_champ': 3, 't1_bot_champ': 4, 't1_support_champ': 5,
        't2_top_champ': 6, 't2_jungle_champ': 7, 't2_mid_champ': 8, 't2_bot_champ': 9, 't2_support_champ': 10,
        'ban_0': 11, 'ban_5': 12, 'ban_1': 13, 'ban_6': 14, 'ban_2': 15,
        'ban_7': 16, 'ban_3': 17, 'ban_8': 18, 'ban_4': 19, 'ban_9': 20
    };

    // Populate Bans
    const bansContainer = document.getElementById('bans-container');
    for (let i = 0; i < 10; i++) {
        const banGroup = document.createElement('div');
        banGroup.className = 'ban-group';

        let teamLabel = i < 5 ? `<span style="color: #3498db; font-size: 0.8rem; font-weight: 600;">Ban Équipe 1</span>`
            : `<span style="color: #e74c3c; font-size: 0.8rem; font-weight: 600;">Ban Équipe 2</span>`;

        const ti = tabIndexMap[`ban_${i}`] || '';

        banGroup.innerHTML = `
            ${teamLabel}
            <div class="input-with-icon">
                <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'><rect width='30' height='30' fill='%23333'/></svg>" class="champ-preview-img" alt="?">
                <input type="text" name="ban_${i}" class="ban-select" list="characters-list" placeholder="Nom du personnage..." tabindex="${ti}">
            </div>
        `;
        bansContainer.appendChild(banGroup);
    }

    // Populate Picks
    const team1Container = document.getElementById('team1-picks');
    const team2Container = document.getElementById('team2-picks');

    roles.forEach((role) => {
        const t1ChampName = `t1_${role.toLowerCase()}_champ`;
        const t2ChampName = `t2_${role.toLowerCase()}_champ`;

        const tiT1 = tabIndexMap[t1ChampName] || '';
        const tiT2 = tabIndexMap[t2ChampName] || '';

        // Team 1
        team1Container.innerHTML += `
            <div class="pick-row">
                <div class="role-icon">${role.substring(0, 3)}</div>
                <div class="input-with-icon">
                    <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'><rect width='30' height='30' fill='%23333'/></svg>" class="champ-preview-img" alt="?">
                    <input type="text" name="${t1ChampName}" class="pick-select" list="characters-list-${role.toLowerCase()}" placeholder="Personnage" required tabindex="${tiT1}">
                </div>
                <div class="kda-inputs">
                    <input type="number" name="t1_${role.toLowerCase()}_k" value="0" required min="0">
                    <input type="number" name="t1_${role.toLowerCase()}_d" value="0" required min="0">
                    <input type="number" name="t1_${role.toLowerCase()}_a" value="0" required min="0">
                </div>
            </div>
        `;

        // Team 2
        team2Container.innerHTML += `
            <div class="pick-row">
                <div class="role-icon">${role.substring(0, 3)}</div>
                <div class="input-with-icon">
                    <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'><rect width='30' height='30' fill='%23333'/></svg>" class="champ-preview-img" alt="?">
                    <input type="text" name="${t2ChampName}" class="pick-select" list="characters-list-${role.toLowerCase()}" placeholder="Personnage" required tabindex="${tiT2}">
                </div>
                <div class="kda-inputs">
                    <input type="number" name="t2_${role.toLowerCase()}_k" value="0" required min="0">
                    <input type="number" name="t2_${role.toLowerCase()}_d" value="0" required min="0">
                    <input type="number" name="t2_${role.toLowerCase()}_a" value="0" required min="0">
                </div>
            </div>
        `;
    });

    function updateDatalists(changedInput = null) {
        const allInputs = document.querySelectorAll('.ban-select, .pick-select');

        // 1. Strict Validation on changed input
        if (changedInput) {
            const val = changedInput.value.trim();
            if (val) {
                let isValid = false;

                // Check if valid character at all
                const matchedChar = characters.find(c => c.toLowerCase() === val.toLowerCase());

                if (matchedChar) {
                    changedInput.value = matchedChar; // Fix casing automatically

                    if (changedInput.classList.contains('pick-select')) {
                        const roleMatch = changedInput.name.match(/t\d_([a-z]+)_champ/);
                        if (roleMatch) {
                            const role = roles.find(r => r.toLowerCase() === roleMatch[1]);
                            if (role && characterRoles[matchedChar] && characterRoles[matchedChar].includes(role.toUpperCase())) {
                                isValid = true;
                            }
                        }
                    } else if (changedInput.classList.contains('ban-select')) {
                        isValid = true;
                    }

                    // Check for duplicates
                    if (isValid) {
                        let count = 0;
                        allInputs.forEach(input => {
                            if (input.value.trim().toLowerCase() === matchedChar.toLowerCase()) count++;
                        });
                        if (count > 1) isValid = false; // Duplicate
                    }
                }

                if (!isValid) {
                    // Force clear if invalid or duplicate
                    changedInput.value = '';
                    changedInput.previousElementSibling.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'><rect width='30' height='30' fill='%23333'/></svg>";
                }
            }
        }

        // 2. Build array of selected champions
        const selectedChamps = [];
        allInputs.forEach(input => {
            const val = input.value.trim();
            if (val && characters.includes(val)) {
                selectedChamps.push(val);
            }
        });

        // 3. Update datalists
        banDatalist.innerHTML = '';
        characters.sort().forEach(char => {
            if (!selectedChamps.includes(char)) {
                const option = document.createElement('option');
                option.value = char;
                banDatalist.appendChild(option);
            }
        });

        roles.forEach(role => {
            const roleDatalist = document.getElementById(`characters-list-${role.toLowerCase()}`);
            if (roleDatalist) {
                roleDatalist.innerHTML = '';
                characters.sort().forEach(char => {
                    if (characterRoles[char] && characterRoles[char].includes(role.toUpperCase()) && !selectedChamps.includes(char)) {
                        const option = document.createElement('option');
                        option.value = char;
                        roleDatalist.appendChild(option);
                    }
                });
            }
        });
    }

    // Call initially once DOM is populated
    updateDatalists();

    // Listen to changes globally
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('pick-select') || e.target.classList.contains('ban-select')) {
            updateDatalists(e.target);
        }
    });

    // Handle Tab autocomplete
    document.addEventListener('keydown', (e) => {
        if ((e.target.classList.contains('pick-select') || e.target.classList.contains('ban-select')) && e.key === 'Tab') {
            const input = e.target;
            const val = input.value.trim().toLowerCase();
            if (val) {
                const datalist = input.list;
                if (datalist) {
                    const options = Array.from(datalist.options);
                    const matchingOptions = options.filter(opt => opt.value.toLowerCase().includes(val));

                    if (matchingOptions.length === 1) {
                        input.value = matchingOptions[0].value;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        }
    });

    // Handle Image Previews
    document.querySelectorAll('.input-with-icon input').forEach(input => {
        input.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const imgEl = e.target.previousElementSibling;

            // Check if input value matches any character (case insensitive)
            const matchedChar = characters.find(c => c.toLowerCase() === val.toLowerCase());

            if (matchedChar) {
                imgEl.src = `images/${matchedChar}.png`;
                e.target.value = matchedChar; // Auto-correct case
            } else {
                // Default placeholder
                imgEl.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30'><rect width='30' height='30' fill='%23333'/></svg>";
            }
        });

        // UX Improvements

        // Auto-select text on focus for KDA inputs
        const kdaInputs = input.parentElement.parentElement.querySelectorAll('.kda-inputs input');
        kdaInputs.forEach((kdaInput, index) => {
            kdaInput.addEventListener('focus', function () {
                this.select();
            });

            // Smart Paste for Kills input
            if (index === 0) { // If it's the "K" input
                kdaInput.addEventListener('paste', function (e) {
                    e.preventDefault();
                    const pasteData = (e.clipboardData || window.clipboardData).getData('text');

                    // Match formats like 10/2/5, 10-2-5, 10 2 5
                    const kdaMatch = pasteData.match(/(\d+)[\/\-\s]+(\d+)[\/\-\s]+(\d+)/);
                    if (kdaMatch && kdaMatch.length === 4) {
                        this.value = kdaMatch[1]; // K
                        kdaInputs[1].value = kdaMatch[2]; // D
                        kdaInputs[2].value = kdaMatch[3]; // A

                        // Move focus to next champ select or submit
                        const nextSelect = kdaInputs[2].closest('.pick-row').nextElementSibling?.querySelector('.pick-select');
                        if (nextSelect) nextSelect.focus();
                    }
                });
            }
        });
    });

    // Handle Form Submission
    const form = document.getElementById('add-match-form');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = document.getElementById('submit-spinner');
    const messageEl = document.getElementById('form-message');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!db) {
            showMessage('Erreur: Connexion à la base de données (Firebase) non initialisée.', 'error');
            return;
        }

        // UI Loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'block';
        messageEl.className = 'form-message';
        messageEl.style.display = 'none';

        try {
            const formData = new FormData(form);

            // Construct Match Data Object
            const matchData = {
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                winner: formData.get('winner'), // 'team1' or 'team2'
                bans: {
                    team1: [],
                    team2: []
                },
                teams: {
                    team1: {},
                    team2: {}
                }
            };

            // Extract Bans
            for (let i = 0; i < 5; i++) {
                const b1 = formData.get(`ban_${i}`);
                if (b1) {
                    // Match casing with character list
                    const matchedB1 = characters.find(c => c.toLowerCase() === b1.trim().toLowerCase());
                    if (matchedB1) matchData.bans.team1.push(matchedB1);
                }

                const b2 = formData.get(`ban_${i + 5}`);
                if (b2) {
                    const matchedB2 = characters.find(c => c.toLowerCase() === b2.trim().toLowerCase());
                    if (matchedB2) matchData.bans.team2.push(matchedB2);
                }
            }

            // Extract Picks
            for (const role of roles) {
                const roleKey = role.toLowerCase();

                // Process Team 1 Pick
                let t1Champ = formData.get(`t1_${roleKey}_champ`);
                if (t1Champ) {
                    const matched = characters.find(c => c.toLowerCase() === t1Champ.trim().toLowerCase());
                    t1Champ = matched || t1Champ;
                }

                matchData.teams.team1[roleKey] = {
                    champion: t1Champ,
                    kda: {
                        kills: parseInt(formData.get(`t1_${roleKey}_k`)) || 0,
                        deaths: parseInt(formData.get(`t1_${roleKey}_d`)) || 0,
                        assists: parseInt(formData.get(`t1_${roleKey}_a`)) || 0
                    }
                };

                // Process Team 2 Pick
                let t2Champ = formData.get(`t2_${roleKey}_champ`);
                if (t2Champ) {
                    const matched = characters.find(c => c.toLowerCase() === t2Champ.trim().toLowerCase());
                    t2Champ = matched || t2Champ;
                }

                matchData.teams.team2[roleKey] = {
                    champion: t2Champ,
                    kda: {
                        kills: parseInt(formData.get(`t2_${roleKey}_k`)) || 0,
                        deaths: parseInt(formData.get(`t2_${roleKey}_d`)) || 0,
                        assists: parseInt(formData.get(`t2_${roleKey}_a`)) || 0
                    }
                };
            }

            // --- VALIDATION RULES ---
            const allSelectedChamps = [];
            let validationError = null;

            // Validate Bans
            const allBans = [...matchData.bans.team1, ...matchData.bans.team2];
            allBans.forEach(ban => {
                if (!characters.includes(ban)) {
                    validationError = `Le ban "${ban}" n'est pas un personnage valide.`;
                }
                if (allSelectedChamps.includes(ban)) {
                    validationError = `Le personnage "${ban}" est banni plusieurs fois !`;
                }
                allSelectedChamps.push(ban);
            });

            if (validationError) throw new Error(validationError);

            // Validate Picks
            for (const role of roles) {
                const roleKey = role.toLowerCase();

                // Validate Team 1
                const t1Champ = matchData.teams.team1[roleKey].champion;
                if (t1Champ) {
                    if (!characters.includes(t1Champ)) {
                        validationError = `Le choix T1 ${role} "${t1Champ}" n'est pas valide.`;
                        break;
                    }
                    if (allSelectedChamps.includes(t1Champ)) {
                        validationError = `Le personnage "${t1Champ}" a été choisi plusieurs fois ou a été banni !`;
                        break;
                    }
                    allSelectedChamps.push(t1Champ);
                }

                // Validate Team 2
                const t2Champ = matchData.teams.team2[roleKey].champion;
                if (t2Champ) {
                    if (!characters.includes(t2Champ)) {
                        validationError = `Le choix T2 ${role} "${t2Champ}" n'est pas valide.`;
                        break;
                    }
                    if (allSelectedChamps.includes(t2Champ)) {
                        validationError = `Le personnage "${t2Champ}" a été choisi plusieurs fois ou a été banni !`;
                        break;
                    }
                    allSelectedChamps.push(t2Champ);
                }
            }

            if (validationError) throw new Error(validationError);
            // --- END VALIDATION ---

            // Prepare Batch Write
            const batch = db.batch();

            // 1. Matches Collection
            const matchRef = db.collection("matches").doc();
            batch.set(matchRef, matchData);

            // Helper to increment champion stats
            const incrementStat = (champName, statField) => {
                if (!champName) return;
                const champRef = db.collection("champions").doc(champName);
                batch.set(champRef, {
                    [statField]: firebase.firestore.FieldValue.increment(1)
                }, { merge: true });
            };

            // 2. Champions Collection (Bans)
            matchData.bans.team1.forEach(champ => incrementStat(champ, "bans"));
            matchData.bans.team2.forEach(champ => incrementStat(champ, "bans"));

            // 3. Champions Collection (Picks) and Champion Scores Collection
            const addChampionScore = (teamData, teamId, roleKey) => {
                if (!teamData.champion) return;

                // Increment pick
                incrementStat(teamData.champion, "picks");

                // Add score document
                const scoreRef = db.collection("champion_scores").doc();
                const isWin = matchData.winner === teamId;

                batch.set(scoreRef, {
                    champion_id: teamData.champion,
                    match_id: matchRef.id,
                    win: isWin,
                    kda: teamData.kda,
                    role: roleKey,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            };

            roles.forEach(role => {
                const roleKey = role.toLowerCase();
                addChampionScore(matchData.teams.team1[roleKey], 'team1', roleKey);
                addChampionScore(matchData.teams.team2[roleKey], 'team2', roleKey);
            });

            // Execute Batch
            await batch.commit();

            showMessage('Le match a été enregistré avec succès !', 'success');
            form.reset();

        } catch (error) {
            console.error("Error adding document: ", error);
            showMessage('Erreur lors de l\'enregistrement : ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = 'block';
            spinner.style.display = 'none';
        }
    });

    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = `form-message ${type}`;
        messageEl.style.display = 'block';
    }
});
