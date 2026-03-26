/* ═══════════════════════════════════════════════════════════
   Internet Seguro — CyberQuiz Game Engine
   Cross-device multiplayer via PeerJS (WebRTC)
   Teacher = host peer, Players = client peers
   ═══════════════════════════════════════════════════════════ */

const AVATARS = ['🤖','👾','🦊','🐱‍💻','🧑‍💻','👤','🦸','🧙','🎯','🛡️','🔮','🕵️'];
const TEAMS = [
    { id:'cyber', name:'Equipo Cyber', emoji:'⚡', color:'#00d4ff' },
    { id:'shield', name:'Equipo Shield', emoji:'🛡️', color:'#00ff88' }
];
const OPT_SHAPES = ['▲','◆','●','■'];
const OPT_COLORS = ['#e74c3c','#2980b9','#f39c12','#27ae60'];
const TIME_PER_Q = 20;
const PTS_BASE = 1000;
const PTS_SPEED = 500;
const PTS_STREAK = 200;
const PEER_PREFIX = 'cquiz-';

// ─── PREGUNTAS basadas en la charla "Internet Seguro" ───
const QUESTIONS = [
    {q:'¿Qué puede pasar si te conectas a una red WiFi pública sin protección?',o:['Navegas más rápido','Pueden robar tu información personal','No pasa nada malo','Se mejora la señal de tu celular'],c:1},
    {q:'¿Cuál de estas contraseñas es la más segura?',o:['123456','tunombre2024','M!g4t0_F3l1z#2024','password'],c:2},
    {q:'¿Por qué no debes usar contraseñas simples como "123456" o tu nombre?',o:['Porque son difíciles de recordar','Porque cualquiera puede adivinarlas fácilmente','Porque ocupan mucha memoria','Porque los sitios web no las aceptan'],c:1},
    {q:'¿Qué debes hacer si recibes un mensaje sospechoso o un link extraño?',o:['Abrirlo para ver qué es','Compartirlo con tus amigos','No abrirlo y reportarlo','Responder pidiendo más información'],c:2},
    {q:'¿Qué información NUNCA debes compartir en internet?',o:['Tu película favorita','Tu contraseña, dirección o datos bancarios','Tu color favorito','El nombre de tu colegio'],c:1},
    {q:'¿Qué es un hackeo?',o:['Un juego de computadora','Cuando alguien accede a tus cuentas sin permiso','Un tipo de aplicación','Una actualización del sistema'],c:1},
    {q:'¿Cuál es una buena práctica al crear contraseñas?',o:['Usar la misma para todo','Combinar letras, números y símbolos','Usar solo números','Escribirla en un papel y pegarla en el monitor'],c:1},
    {q:'Si algo en internet parece demasiado bueno para ser verdad, ¿qué deberías pensar?',o:['Es una gran oportunidad','Probablemente es falso o un engaño','Debo compartirlo rápido','Es completamente seguro'],c:1},
    {q:'¿Por qué debes evitar conectarte a WiFi público para cosas importantes?',o:['Porque es muy lento','Porque pueden interceptar tus datos','Porque gasta más batería','Porque no funciona bien'],c:1},
    {q:'¿Qué debes hacer si un desconocido te envía una solicitud en redes sociales?',o:['Aceptarla inmediatamente','Aceptarla si tiene foto de perfil','No aceptarla, puede tener malas intenciones','Enviarle tus datos para que te conozca'],c:2},
    {q:'¿Por qué no es recomendable publicar tu ubicación en redes sociales?',o:['Porque gasta batería','Porque personas con malas intenciones pueden saber dónde estás','Porque a nadie le interesa','Porque es ilegal'],c:1},
    {q:'¿Qué debes hacer si recibes mensajes extraños o sospechosos en redes sociales?',o:['Responder para saber quién es','No responder y bloquear a esa persona','Compartirlo en tu perfil','Enviar tus datos para verificar'],c:1},
    {q:'¿Por qué debemos pensar antes de publicar algo en internet?',o:['Porque todo lo que subimos puede quedarse ahí para siempre','Porque es aburrido publicar','Porque internet se llena','Porque solo lo ven tus amigos'],c:0},
    {q:'¿Qué son los mensajes falsos o links peligrosos en internet?',o:['Actualizaciones del sistema','Engaños donde sin darte cuenta entregas tu información','Promociones reales de tiendas','Mensajes del gobierno'],c:1},
    {q:'Según la charla, ¿de quién depende la seguridad en internet?',o:['Solo de los programadores','Solo del gobierno','De cada uno de nosotros y nuestras decisiones','Solo de los antivirus'],c:2}
];

// ─── ESTADO GLOBAL ───
let S = {
    role:null, roomCode:null, playerId:null, playerName:null,
    playerAvatar:null, playerTeam:null, currentQ:0,
    score:0, streak:0, answered:false, timerIv:null, timeLeft:TIME_PER_Q
};

// PeerJS
let peer = null;
let conns = [];        // Teacher: array of DataConnection to players
let hostConn = null;   // Player: DataConnection to teacher

// Room state (teacher holds authoritative copy, players get synced copy)
let room = null;

// ─── UTILIDADES ───
const genId = () => Math.random().toString(36).substr(2,9);
function genCode(){
    const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r='';
    for(let i=0;i<6;i++) r+=c[Math.floor(Math.random()*c.length)];
    return r;
}
function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
}
function shuffle(a){
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
    return a;
}

// ═══════════ TEACHER: BROADCAST TO ALL PLAYERS ═══════════
function broadcast(msg){
    conns.forEach(c=>{ try{c.send(msg)}catch{} });
}

// ═══════════ CREAR SALA (TEACHER) ═══════════
function createRoom(){
    const code = genCode();
    S.role='teacher'; S.roomCode=code; S.playerId='t_'+genId();

    room = {
        code, players:[], started:false, currentQ:0, answers:{},
        qOrder: shuffle([...Array(QUESTIONS.length).keys()])
    };

    // Create PeerJS host
    const peerId = PEER_PREFIX + code;
    peer = new Peer(peerId);

    peer.on('open', ()=>{
        document.getElementById('teacher-room-code').textContent = code;
        refreshTeacherLobby();
        showScreen('screen-teacher-lobby');
    });

    peer.on('connection', conn => {
        conn.on('open', ()=>{
            conns.push(conn);
            // Send current room state to new connection
            conn.send({type:'room-sync', room});
        });
        conn.on('data', data => handleTeacherMsg(data, conn));
        conn.on('close', ()=>{
            conns = conns.filter(c => c !== conn);
        });
    });

    peer.on('error', err => {
        console.error('Peer error:', err);
        if(err.type === 'unavailable-id'){
            document.getElementById('start-error').textContent = 'Código ocupado, intenta de nuevo';
            peer.destroy();
            createRoom(); // retry with new code
        }
    });
}

// Teacher handles messages from players
function handleTeacherMsg(msg, conn){
    switch(msg.type){
        case 'join':
            room.players.push(msg.player);
            refreshTeacherLobby();
            // Broadcast updated room to all
            broadcast({type:'room-sync', room});
            break;
        case 'answer':
            if(!room.answers[msg.qi]) room.answers[msg.qi] = [];
            // Avoid duplicate answers
            if(room.answers[msg.qi].find(a=>a.pid===msg.pid)) break;
            // Calculate score
            const q = QUESTIONS[room.qOrder[msg.qi]];
            const ok = msg.oi === q.c;
            let pts = 0;
            const pl = room.players.find(p=>p.id===msg.pid);
            if(ok && pl){
                const speedRatio = Math.max(0, 1 - msg.time/TIME_PER_Q);
                pts = PTS_BASE + Math.round(PTS_SPEED * speedRatio);
                pl.streak = (pl.streak||0) + 1;
                if(pl.streak >= 3) pts += PTS_STREAK;
                pl.score += pts;
            } else if(pl){
                pl.streak = 0;
            }
            room.answers[msg.qi].push({pid:msg.pid, oi:msg.oi, time:msg.time, ok, pts});
            // Send result to the answering player
            conn.send({type:'answer-result', ok, pts, score:pl?pl.score:0, streak:pl?pl.streak:0});
            // Update teacher display
            refreshTQStats();
            // Broadcast updated room
            broadcast({type:'room-sync', room});
            // Check if all answered
            if(room.answers[msg.qi].length >= room.players.length && S.timeLeft > 0){
                clearInterval(S.timerIv);
                setTimeout(()=>{
                    broadcast({type:'show-results'});
                    showTeacherResults();
                }, 500);
            }
            break;
    }
}

// ═══════════ UNIRSE A SALA (PLAYER) ═══════════
function joinRoomStep1(){
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    const err = document.getElementById('join-error');
    if(!code||code.length<4){err.textContent='Ingresa un código válido';return}
    err.textContent='Conectando...';

    S.roomCode = code; S.role = 'player'; S.playerId = 'p_' + genId();

    // Create player peer and connect to teacher
    peer = new Peer();
    peer.on('open', ()=>{
        const hostId = PEER_PREFIX + code;
        hostConn = peer.connect(hostId, {reliable:true});

        hostConn.on('open', ()=>{
            err.textContent='';
            // We'll wait for room-sync to build the setup
        });

        hostConn.on('data', data => handlePlayerMsg(data));

        hostConn.on('close', ()=>{
            // Host disconnected
            if(S.role === 'player'){
                alert('El profesor cerró la sala');
                backToHome();
            }
        });

        hostConn.on('error', e => {
            err.textContent='No se pudo conectar a la sala';
            console.error('Connection error:', e);
        });

        // Timeout if no connection
        setTimeout(()=>{
            if(!hostConn || !hostConn.open){
                err.textContent='Sala no encontrada o profesor desconectado';
            }
        }, 5000);
    });

    peer.on('error', err2 => {
        console.error('Peer error:', err2);
        err.textContent='Error de conexión. Intenta de nuevo.';
    });
}

// Player handles messages from teacher
function handlePlayerMsg(msg){
    switch(msg.type){
        case 'room-sync':
            room = msg.room;
            // If we haven't joined yet (first sync), show setup
            if(!S.playerName && !room.started){
                buildSetup(room);
                showScreen('screen-player-setup');
            }
            // If we're in lobby, update info
            if(S.playerName && !room.started){
                refreshPlayerLobby();
            }
            break;
        case 'game-start':
            startCountdown();
            break;
        case 'show-question':
            showPlayerQ(msg.qi);
            break;
        case 'answer-result':
            S.score = msg.score;
            S.streak = msg.streak;
            // Feedback is already shown by playerAns
            break;
        case 'show-results':
            // El jugador se queda en la pantalla de la pregunta viendo 
            // el feedback (Correcto/Incorrecto) hasta la próxima pregunta
            break;
        case 'next-question':
            S.answered = false;
            showPlayerQ(msg.qi);
            break;
        case 'game-over':
            room = msg.room; // get final scores
            showFinal();
            break;
        case 'time-up':
            if(!S.answered){
                S.answered = true;
                clearInterval(S.timerIv);
                showTimeUpFeedback();
            }
            break;
    }
}

function buildSetup(rm){
    document.getElementById('avatar-grid').innerHTML = AVATARS.map((a,i)=>
        `<div class="avatar-item" data-i="${i}" onclick="selAvatar(this)">${a}</div>`).join('');
    const t1=rm.players.filter(p=>p.team==='cyber').length;
    const t2=rm.players.filter(p=>p.team==='shield').length;
    const diff=Math.abs(t1-t2);
    document.getElementById('team-select').innerHTML = TEAMS.map((t,i)=>{
        const cnt=i===0?t1:t2; const dis=diff>=1&&(i===0?t1>t2:t2>t1);
        return `<div class="team-card team${i+1} ${dis?'disabled':''}" data-team="${t.id}" onclick="selTeam(this)">
            <div class="team-emoji">${t.emoji}</div>
            <h3 style="color:${t.color}">${t.name}</h3>
            <div class="team-count">${cnt} jugador${cnt!==1?'es':''}</div></div>`;
    }).join('');
}
function selAvatar(el){
    document.querySelectorAll('.avatar-item').forEach(a=>a.classList.remove('selected'));
    el.classList.add('selected'); S.playerAvatar=el.textContent;
}
function selTeam(el){
    if(el.classList.contains('disabled'))return;
    document.querySelectorAll('.team-card').forEach(c=>c.classList.remove('selected'));
    el.classList.add('selected'); S.playerTeam=el.dataset.team;
}

function joinRoomFinal(){
    const name=document.getElementById('input-player-name').value.trim();
    const err=document.getElementById('setup-error');
    if(!name){err.textContent='Ingresa tu nombre';return}
    if(!S.playerAvatar){err.textContent='Elige un avatar';return}
    if(!S.playerTeam){err.textContent='Elige un equipo';return}
    err.textContent=''; S.playerName=name;

    // Send join message to teacher
    hostConn.send({
        type:'join',
        player:{id:S.playerId, name:S.playerName, avatar:S.playerAvatar, team:S.playerTeam, score:0, streak:0}
    });

    document.getElementById('player-room-code').textContent = S.roomCode;
    showScreen('screen-player-lobby');
}

// ═══════════ LOBBY ═══════════
function refreshTeacherLobby(){
    if(!room) return;
    document.getElementById('lobby-teams').innerHTML = TEAMS.map(t=>{
        const m=room.players.filter(p=>p.team===t.id);
        return `<div class="lobby-team-card"><h3><span style="color:${t.color}">${t.emoji} ${t.name}</span> <span style="color:var(--text3);font-weight:400;font-size:.85rem">(${m.length})</span></h3>
        ${m.length===0?'<p style="color:var(--text3);font-size:.85rem">Sin jugadores</p>':
        m.map(p=>`<div class="lobby-player"><span class="lp-avatar">${p.avatar}</span>${p.name}</div>`).join('')}</div>`;
    }).join('');
    const btn=document.getElementById('btn-start-game');
    const err=document.getElementById('start-error');
    if(room.players.length<2){btn.disabled=true;err.textContent='Se necesitan al menos 2 jugadores'}
    else{btn.disabled=false;err.textContent=''}
}

function refreshPlayerLobby(){
    if(!room) return;
    const t1=room.players.filter(p=>p.team==='cyber').length;
    const t2=room.players.filter(p=>p.team==='shield').length;
    document.getElementById('player-lobby-info').innerHTML=`⚡ Cyber: ${t1} · 🛡️ Shield: ${t2}`;
}

// ═══════════ OPEN PLAYER TAB ═══════════
function openPlayerTab(){
    const url = location.href.split('#')[0] + '#room=' + S.roomCode;
    window.open(url, '_blank');
}

// ═══════════ INICIAR JUEGO ═══════════
function startGame(){
    if(!room || room.players.length<2) return;
    room.started = true;
    broadcast({type:'game-start'});
    startCountdown();
}

function startCountdown(){
    showScreen('screen-countdown');
    let c=3; const el=document.getElementById('countdown-number'); el.textContent=c;
    const iv=setInterval(()=>{
        c--; if(c>0){el.textContent=c}
        else{clearInterval(iv);
            if(S.role==='teacher'){
                S.currentQ = 0;
                showTeacherQ(0);
                broadcast({type:'show-question', qi:0});
            } else {
                showPlayerQ(0);
            }
        }
    },1000);
}

// ═══════════ PREGUNTA — PROFESOR ═══════════
function showTeacherQ(qi){
    if(!room) return;
    const q=QUESTIONS[room.qOrder[qi]]; S.currentQ=qi;
    document.getElementById('tq-progress').textContent=`Pregunta ${qi+1}/${room.qOrder.length}`;
    document.getElementById('tq-question').textContent=q.q;
    document.getElementById('tq-total-players').textContent=`de ${room.players.length}`;
    document.getElementById('tq-answered').textContent='0';
    document.getElementById('tq-options').innerHTML=q.o.map((o,i)=>
        `<div class="opt-display-item"><div class="opt-shape" style="background:${OPT_COLORS[i]}">${OPT_SHAPES[i]}</div><span>${o}</span></div>`).join('');
    updateTeamScores();
    showScreen('screen-teacher-question');
    S.timeLeft=TIME_PER_Q;
    document.getElementById('tq-timer').textContent=`⏱ ${S.timeLeft}s`;
    clearInterval(S.timerIv);
    if(!room.answers[qi]) room.answers[qi]=[];

    S.timerIv=setInterval(()=>{
        S.timeLeft--;
        document.getElementById('tq-timer').textContent=`⏱ ${S.timeLeft}s`;
        if(S.timeLeft<=0){
            clearInterval(S.timerIv);
            broadcast({type:'time-up'});
            setTimeout(()=>{
                broadcast({type:'show-results'});
                showTeacherResults();
            },1000);
        }
    },1000);
}

function refreshTQStats(){
    if(!room) return;
    const ans=room.answers[S.currentQ]||[];
    document.getElementById('tq-answered').textContent=ans.length;
    updateTeamScores();
}

function updateTeamScores(){
    if(!room) return;
    let s1=0,s2=0;
    room.players.forEach(p=>{if(p.team==='cyber')s1+=p.score;else s2+=p.score});
    document.getElementById('tq-team1-score').textContent=s1;
    document.getElementById('tq-team2-score').textContent=s2;
}

// ═══════════ PREGUNTA — JUGADOR ═══════════
function showPlayerQ(qi){
    if(!room) return;
    const q=QUESTIONS[room.qOrder[qi]]; S.currentQ=qi; S.answered=false;
    document.getElementById('pq-progress').textContent=`${qi+1}/${room.qOrder.length}`;
    document.getElementById('pq-question').textContent=q.q;
    document.getElementById('pq-feedback').classList.add('hidden');
    document.getElementById('pq-options').innerHTML=q.o.map((o,i)=>
        `<button class="option-btn opt-${i}" onclick="playerAns(${qi},${i},this)">
        <span class="opt-shape">${OPT_SHAPES[i]}</span><span>${o}</span></button>`).join('');
    S.timeLeft=TIME_PER_Q;
    document.getElementById('pq-timer').textContent=S.timeLeft+'s';
    document.getElementById('pq-timer-fill').style.width='100%';
    clearInterval(S.timerIv);
    showScreen('screen-player-question');
    const t0=Date.now();
    S.timerIv=setInterval(()=>{
        const el=(Date.now()-t0)/1000;
        S.timeLeft=Math.max(0,TIME_PER_Q-Math.floor(el));
        const pct=Math.max(0,(1-el/TIME_PER_Q)*100);
        document.getElementById('pq-timer').textContent=S.timeLeft+'s';
        document.getElementById('pq-timer-fill').style.width=pct+'%';
        if(S.timeLeft<=0){clearInterval(S.timerIv);if(!S.answered){S.answered=true;showTimeUpFeedback()}}
    },200);
}

function playerAns(qi,oi,btn){
    if(S.answered) return; S.answered=true; clearInterval(S.timerIv);
    const used = TIME_PER_Q - S.timeLeft;

    // Send answer to teacher (teacher calculates score)
    hostConn.send({type:'answer', qi, oi, time:used, pid:S.playerId});

    // Show visual feedback locally
    const q = QUESTIONS[room.qOrder[qi]];
    const ok = oi === q.c;
    document.querySelectorAll('#pq-options .option-btn').forEach((b,i)=>{
        b.classList.add('disabled');
        if(i===q.c) b.classList.add('correct');
        else if(i===oi && !ok) b.classList.add('wrong');
    });
    const fb=document.getElementById('pq-feedback'); fb.classList.remove('hidden');
    if(ok){
        fb.innerHTML=`<div class="feedback-content"><div class="feedback-icon">✅</div>
        <div class="feedback-text" style="color:var(--success)">¡Correcto!</div>
        <div style="color:var(--text2);font-size:.9rem;margin-top:12px">Esperando a que el profesor avance...</div></div>`;
    } else {
        fb.innerHTML=`<div class="feedback-content"><div class="feedback-icon">❌</div>
        <div class="feedback-text" style="color:var(--danger)">Incorrecto</div>
        <div style="color:var(--text2);font-size:.95rem;margin-top:12px">Esperando a que el profesor avance...</div></div>`;
    }
}

function showTimeUpFeedback(){
    // Send empty answer to teacher
    if(hostConn && hostConn.open){
        hostConn.send({type:'answer', qi:S.currentQ, oi:-1, time:TIME_PER_Q, pid:S.playerId});
    }
    const fb=document.getElementById('pq-feedback'); fb.classList.remove('hidden');
    fb.innerHTML=`<div class="feedback-content"><div class="feedback-icon">⏰</div>
    <div class="feedback-text" style="color:var(--neon-yellow)">¡Tiempo agotado!</div>
    <div style="color:var(--text3);font-size:.85rem;margin-top:8px">Esperando la siguiente pregunta...</div></div>`;
}

// ═══════════ RESULTADOS — PROFESOR ═══════════
function showTeacherResults(){
    clearInterval(S.timerIv);
    if(!room) return;
    const q=QUESTIONS[room.qOrder[S.currentQ]];
    const ans=room.answers[S.currentQ]||[];
    document.getElementById('tr-answer-stats').innerHTML=q.o.map((o,i)=>{
        const cnt=ans.filter(a=>a.oi===i).length;
        const pct=ans.length?Math.round(cnt/ans.length*100):0;
        const cor=i===q.c;
        return `<div class="answer-stat-bar ${cor?'is-correct':'is-wrong'}">
        <div class="asb-fill" style="width:${pct}%;background:${OPT_COLORS[i]}"></div>
        <span class="opt-shape" style="background:${OPT_COLORS[i]};width:28px;height:28px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:.85rem;flex-shrink:0;position:relative;z-index:1">${OPT_SHAPES[i]}</span>
        <span style="position:relative;z-index:1">${o} ${cor?'✅':''}</span>
        <span class="asb-count" style="position:relative;z-index:1">${cnt}</span></div>`;
    }).join('');
    const sorted=[...room.players].sort((a,b)=>b.score-a.score);
    document.getElementById('tr-player-ranking').innerHTML=sorted.map((p,i)=>
        `<div class="rank-item"><span class="rank-pos">${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)}</span>
        <span class="rank-avatar">${p.avatar}</span><span class="rank-name">${p.name}</span>
        <span class="rank-score">${p.score} pts</span></div>`).join('');
    showScreen('screen-teacher-results');
}

// ═══════════ RESULTADO — JUGADOR ═══════════
function showPlayerResult(){
    document.getElementById('pr-icon').textContent = S.score > 0 ? '🎉' : '💪';
    document.getElementById('pr-title').textContent = S.score > 0 ? '¡Excelente!' : '¡Sigue intentando!';
    document.getElementById('pr-title').style.color = S.score > 0 ? 'var(--success)' : 'var(--neon-yellow)';
    document.getElementById('pr-points').textContent = S.score + ' pts totales';
    document.getElementById('pr-streak').textContent = S.streak >= 2 ? `🔥 Racha de ${S.streak}` : '';
    showScreen('screen-player-result');
}

// ═══════════ SIGUIENTE PREGUNTA ═══════════
function nextQuestion(){
    if(!room) return;
    const nq = S.currentQ + 1;
    if(nq >= room.qOrder.length){
        room.gameOver = true;
        broadcast({type:'game-over', room});
        showFinal();
        return;
    }
    room.currentQ = nq;
    broadcast({type:'next-question', qi:nq});
    showTeacherQ(nq);
}

// ═══════════ PANTALLA FINAL ═══════════
function showFinal(){
    clearInterval(S.timerIv);
    if(!room) return;
    const ts=TEAMS.map(t=>{
        const m=room.players.filter(p=>p.team===t.id);
        return {...t,members:m,total:m.reduce((s,p)=>s+p.score,0)};
    }).sort((a,b)=>b.total-a.total);
    const w=ts[0];
    document.getElementById('final-winner-team').innerHTML=`
        <h2>🏆 ${w.emoji} ${w.name} ¡Gana!</h2>
        <p style="font-family:var(--font-display);font-size:1.4rem;margin-bottom:16px;color:var(--neon-yellow)">${w.total} pts</p>
        <div class="wt-members">${w.members.map(p=>`<div class="wt-member">${p.avatar} ${p.name} — <strong>${p.score} pts</strong></div>`).join('')}</div>`;
    const all=[...room.players].sort((a,b)=>b.score-a.score);
    const mvp=all[0];
    if(mvp) document.getElementById('final-mvp').innerHTML=`
        <div class="mvp-crown">👑</div><div class="mvp-label">⭐ MVP ⭐</div>
        <div class="mvp-name">${mvp.avatar} ${mvp.name}</div><div class="mvp-score">${mvp.score} pts</div>`;
    document.getElementById('final-team-ranking').innerHTML=`<h3>📊 Ranking por Equipo</h3>
        ${ts.map((t,i)=>`<div class="rank-item"><span class="rank-pos">${i===0?'🥇':'🥈'}</span>
        <span class="rank-avatar">${t.emoji}</span><span class="rank-name">${t.name}</span>
        <span class="rank-score">${t.total} pts</span></div>`).join('')}`;
    document.getElementById('final-player-ranking').innerHTML=`<h3>👤 Ranking Individual</h3>
        ${all.map((p,i)=>`<div class="rank-item"><span class="rank-pos">${i===0?'👑':i===1?'🥈':i===2?'🥉':(i+1)}</span>
        <span class="rank-avatar">${p.avatar}</span><span class="rank-name">${p.name}${i===0?' <span style="color:var(--neon-yellow)">MVP</span>':''}</span>
        <span class="rank-score">${p.score} pts</span></div>`).join('')}`;
    showScreen('screen-final'); spawnConfetti();
}

function spawnConfetti(){
    const cols=['#00d4ff','#00ff88','#a855f7','#ff2d95','#ffd600','#e74c3c','#3498db'];
    for(let i=0;i<80;i++){
        const p=document.createElement('div'); p.className='confetti-piece';
        p.style.setProperty('--left',Math.random()*100+'%');
        p.style.setProperty('--fall-d',(2+Math.random()*3)+'s');
        p.style.background=cols[Math.floor(Math.random()*cols.length)];
        p.style.borderRadius=Math.random()>.5?'50%':'2px';
        p.style.width=(6+Math.random()*8)+'px'; p.style.height=(6+Math.random()*8)+'px';
        p.style.animationDelay=Math.random()*2+'s';
        document.body.appendChild(p); setTimeout(()=>p.remove(),6000);
    }
}

function backToHome(){
    clearInterval(S.timerIv);
    if(peer){ try{peer.destroy()}catch{} peer=null; }
    conns=[]; hostConn=null; room=null;
    S={role:null,roomCode:null,playerId:null,playerName:null,playerAvatar:null,
       playerTeam:null,currentQ:0,score:0,streak:0,answered:false,timerIv:null,timeLeft:TIME_PER_Q};
    showScreen('screen-home');
}

// ═══════════ MATRIX RAIN CANVAS ═══════════
(function initMatrix(){
    const cvs = document.getElementById('matrix-canvas');
    if(!cvs) return;
    const ctx = cvs.getContext('2d');
    let W, H, cols, drops;
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン<>{}[]+=*&#@!?/\\|';
    const fontSize = 14;
    let mouseX = -1000, mouseY = -1000;
    const mouseRadius = 120;

    function resize(){
        W = cvs.width = window.innerWidth;
        H = cvs.height = window.innerHeight;
        cols = Math.floor(W / fontSize);
        drops = new Array(cols).fill(1).map(()=> Math.floor(Math.random()*H/fontSize));
    }
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    document.addEventListener('mouseleave', () => { mouseX = -1000; mouseY = -1000; });

    function draw(){
        ctx.fillStyle = 'rgba(10, 14, 26, 0.06)';
        ctx.fillRect(0, 0, W, H);
        for(let i = 0; i < cols; i++){
            const x = i * fontSize;
            const y = drops[i] * fontSize;
            const dx = x - mouseX, dy = y - mouseY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if(dist < mouseRadius){
                const intensity = 1 - dist / mouseRadius;
                ctx.fillStyle = `rgba(0, ${Math.floor(200+55*intensity)}, ${Math.floor(100*intensity)}, ${0.9+intensity*0.1})`;
                ctx.font = `bold ${fontSize + Math.floor(intensity*4)}px monospace`;
            } else {
                const br = Math.random()*0.5+0.3;
                ctx.fillStyle = `rgba(0, ${Math.floor(212*br)}, ${Math.floor(255*br*0.5)}, ${br})`;
                ctx.font = `${fontSize}px monospace`;
            }
            ctx.fillText(chars[Math.floor(Math.random()*chars.length)], x, y);
            if(y > H && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
        requestAnimationFrame(draw);
    }
    draw();
})();

// ═══════════ AUTO-JOIN DESDE URL HASH ═══════════
window.addEventListener('DOMContentLoaded', ()=>{
    const hash = location.hash;
    if(hash.startsWith('#room=')){
        const code = hash.replace('#room=','').trim().toUpperCase();
        if(code.length >= 4){
            document.getElementById('input-room-code').value = code;
            setTimeout(()=> showScreen('screen-join'), 300);
        }
        history.replaceState(null, '', location.href.split('#')[0]);
    }
});
