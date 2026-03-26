/* ═══════════════════════════════════════════════════════════
   Internet Seguro — CyberQuiz Game Engine
   Multiplayer via BroadcastChannel + localStorage
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
let channel = null;
let lobbyPoll = null, teacherPoll = null, playerWaitPoll = null;

// ─── UTILIDADES ───
const genId = () => Math.random().toString(36).substr(2,9);
function genCode(){
    const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r='';
    for(let i=0;i<6;i++) r+=c[Math.floor(Math.random()*c.length)];
    return r;
}
const getRoom = code => { try{return JSON.parse(localStorage.getItem('room_'+code))}catch{return null} };
const saveRoom = room => localStorage.setItem('room_'+room.code, JSON.stringify(room));
const rmRoom = code => localStorage.removeItem('room_'+code);

function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
}

function shuffle(a){
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
    return a;
}

// ─── BROADCASTCHANNEL ───
function initChannel(code){
    if(channel) channel.close();
    channel = new BroadcastChannel('cq_'+code);
    channel.onmessage = e => handleMsg(e.data);
}
function bcast(type, data={}){
    if(channel) channel.postMessage({type,...data,sid:S.playerId});
}

function handleMsg(m){
    if(m.sid===S.playerId) return;
    switch(m.type){
        case 'player-joined': case 'player-update':
            if(S.role==='teacher') refreshTeacherLobby();
            if(S.role==='player') refreshPlayerLobby();
            break;
        case 'game-start': startCountdown(); break;
        case 'show-question':
            if(S.role==='player') showPlayerQ(m.qi); break;
        case 'player-answered':
            if(S.role==='teacher') refreshTQStats(); break;
        case 'show-results':
            if(S.role==='teacher') showTeacherResults();
            if(S.role==='player') showPlayerResult();
            break;
        case 'next-question':
            if(S.role==='player'){S.answered=false; showPlayerQ(m.qi);} break;
        case 'game-over': showFinal(); break;
        case 'time-up':
            if(S.role==='player' && !S.answered){
                S.answered=true; clearInterval(S.timerIv); showTimeUp();
            } break;
    }
}

// ═══════════ CREAR SALA ═══════════
function createRoom(){
    const code = genCode();
    S.role='teacher'; S.roomCode=code; S.playerId='t_'+genId();
    const room = {
        code, players:[], started:false, currentQ:0, answers:{},
        qOrder: shuffle([...Array(QUESTIONS.length).keys()])
    };
    saveRoom(room);
    initChannel(code);
    document.getElementById('teacher-room-code').textContent = code;
    refreshTeacherLobby();
    showScreen('screen-teacher-lobby');
    startLobbyPoll();
}

// Abre una nueva pestaña del mismo archivo para un jugador (garantiza mismo origin)
function openPlayerTab(){
    const url = location.href.split('#')[0] + '#room=' + S.roomCode;
    window.open(url, '_blank');
}

// ═══════════ UNIRSE A SALA ═══════════
function joinRoomStep1(){
    const code = document.getElementById('input-room-code').value.trim().toUpperCase();
    const err = document.getElementById('join-error');
    if(!code||code.length<4){err.textContent='Ingresa un código válido';return}
    const room = getRoom(code);
    if(!room){err.textContent='Sala no encontrada';return}
    if(room.started){err.textContent='El juego ya inició';return}
    err.textContent='';
    S.roomCode=code; S.role='player'; S.playerId='p_'+genId();
    initChannel(code);
    buildSetup(room);
    showScreen('screen-player-setup');
}

function buildSetup(room){
    document.getElementById('avatar-grid').innerHTML = AVATARS.map((a,i)=>
        `<div class="avatar-item" data-i="${i}" onclick="selAvatar(this)">${a}</div>`).join('');
    const t1=room.players.filter(p=>p.team==='cyber').length;
    const t2=room.players.filter(p=>p.team==='shield').length;
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
    const room=getRoom(S.roomCode);
    if(!room){err.textContent='Sala no encontrada';return}
    if(room.started){err.textContent='El juego ya comenzó';return}
    room.players.push({id:S.playerId,name:S.playerName,avatar:S.playerAvatar,team:S.playerTeam,score:0,streak:0});
    saveRoom(room); bcast('player-joined');
    document.getElementById('player-room-code').textContent=S.roomCode;
    refreshPlayerLobby();
    showScreen('screen-player-lobby');
    startLobbyPoll();
}

// ═══════════ LOBBY ═══════════
function startLobbyPoll(){
    if(lobbyPoll)clearInterval(lobbyPoll);
    lobbyPoll=setInterval(()=>{
        const room=getRoom(S.roomCode); if(!room)return;
        if(S.role==='teacher') refreshTeacherLobby();
        if(S.role==='player'){
            refreshPlayerLobby();
            if(room.started){clearInterval(lobbyPoll);startCountdown()}
        }
    },800);
}
function refreshTeacherLobby(){
    const room=getRoom(S.roomCode); if(!room)return;
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
    const room=getRoom(S.roomCode); if(!room)return;
    const t1=room.players.filter(p=>p.team==='cyber').length;
    const t2=room.players.filter(p=>p.team==='shield').length;
    document.getElementById('player-lobby-info').innerHTML=`⚡ Cyber: ${t1} · 🛡️ Shield: ${t2}`;
}

// ═══════════ INICIAR JUEGO ═══════════
function startGame(){
    const room=getRoom(S.roomCode);
    if(!room||room.players.length<2)return;
    room.started=true; room.currentQ=0; saveRoom(room);
    bcast('game-start'); clearInterval(lobbyPoll); startCountdown();
}
function startCountdown(){
    showScreen('screen-countdown');
    let c=3; const el=document.getElementById('countdown-number'); el.textContent=c;
    const iv=setInterval(()=>{
        c--; if(c>0){el.textContent=c}
        else{clearInterval(iv);
            if(S.role==='teacher'){showTeacherQ(0);bcast('show-question',{qi:0})}
            else showPlayerQ(0);
        }
    },1000);
}

// ═══════════ PREGUNTA — PROFESOR ═══════════
function showTeacherQ(qi){
    const room=getRoom(S.roomCode); if(!room)return;
    const q=QUESTIONS[room.qOrder[qi]]; S.currentQ=qi;
    document.getElementById('tq-progress').textContent=`Pregunta ${qi+1}/${room.qOrder.length}`;
    document.getElementById('tq-question').textContent=q.q;
    document.getElementById('tq-total-players').textContent=`de ${room.players.length}`;
    document.getElementById('tq-answered').textContent='0';
    document.getElementById('tq-options').innerHTML=q.o.map((o,i)=>
        `<div class="opt-display-item"><div class="opt-shape" style="background:${OPT_COLORS[i]}">${OPT_SHAPES[i]}</div><span>${o}</span></div>`).join('');
    updateTeamScores(room);
    showScreen('screen-teacher-question');
    S.timeLeft=TIME_PER_Q;
    document.getElementById('tq-timer').textContent=`⏱ ${S.timeLeft}s`;
    clearInterval(S.timerIv);
    S.timerIv=setInterval(()=>{
        S.timeLeft--;
        document.getElementById('tq-timer').textContent=`⏱ ${S.timeLeft}s`;
        if(S.timeLeft<=0){
            clearInterval(S.timerIv); bcast('time-up');
            setTimeout(()=>{showTeacherResults();bcast('show-results')},1000);
        }
    },1000);
    if(!room.answers[qi])room.answers[qi]=[];
    saveRoom(room); startTeacherPoll();
}
function startTeacherPoll(){
    if(teacherPoll)clearInterval(teacherPoll);
    teacherPoll=setInterval(()=>refreshTQStats(),500);
}
function refreshTQStats(){
    const room=getRoom(S.roomCode); if(!room)return;
    const ans=room.answers[S.currentQ]||[];
    document.getElementById('tq-answered').textContent=ans.length;
    updateTeamScores(room);
    if(ans.length>=room.players.length && S.timeLeft>0){
        clearInterval(S.timerIv); clearInterval(teacherPoll);
        setTimeout(()=>{bcast('show-results');showTeacherResults()},500);
    }
}
function updateTeamScores(room){
    let s1=0,s2=0;
    room.players.forEach(p=>{if(p.team==='cyber')s1+=p.score;else s2+=p.score});
    document.getElementById('tq-team1-score').textContent=s1;
    document.getElementById('tq-team2-score').textContent=s2;
}

// ═══════════ PREGUNTA — JUGADOR ═══════════
function showPlayerQ(qi){
    const room=getRoom(S.roomCode); if(!room)return;
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
        if(S.timeLeft<=0){clearInterval(S.timerIv);if(!S.answered){S.answered=true;showTimeUp()}}
    },200);
}

function playerAns(qi,oi,btn){
    if(S.answered)return; S.answered=true; clearInterval(S.timerIv);
    const room=getRoom(S.roomCode); if(!room)return;
    const q=QUESTIONS[room.qOrder[qi]];
    const ok=oi===q.c;
    const used=TIME_PER_Q-S.timeLeft;
    let pts=0;
    if(ok){
        pts=PTS_BASE+Math.round(PTS_SPEED*Math.max(0,1-used/TIME_PER_Q));
        const pl=room.players.find(p=>p.id===S.playerId);
        if(pl){pl.streak=(pl.streak||0)+1;if(pl.streak>=3)pts+=PTS_STREAK;pl.score+=pts;S.score=pl.score;S.streak=pl.streak}
    } else {
        const pl=room.players.find(p=>p.id===S.playerId);
        if(pl){pl.streak=0;S.streak=0}
    }
    if(!room.answers[qi])room.answers[qi]=[];
    room.answers[qi].push({pid:S.playerId,oi,time:used,ok,pts});
    saveRoom(room); bcast('player-answered');
    // Visual
    document.querySelectorAll('#pq-options .option-btn').forEach((b,i)=>{
        b.classList.add('disabled');
        if(i===q.c)b.classList.add('correct');
        else if(i===oi&&!ok)b.classList.add('wrong');
    });
    const fb=document.getElementById('pq-feedback'); fb.classList.remove('hidden');
    if(ok){
        fb.innerHTML=`<div class="feedback-content"><div class="feedback-icon">✅</div>
        <div class="feedback-text" style="color:var(--success)">¡Correcto!</div>
        <div style="color:var(--neon-green);font-family:var(--font-display);font-size:1.8rem;margin-top:8px">+${pts}</div></div>`;
    } else {
        fb.innerHTML=`<div class="feedback-content"><div class="feedback-icon">❌</div>
        <div class="feedback-text" style="color:var(--danger)">Incorrecto</div>
        <div style="color:var(--text2);margin-top:8px">Respuesta: ${q.o[q.c]}</div></div>`;
    }
}

function showTimeUp(){
    const room=getRoom(S.roomCode); if(!room)return;
    const pl=room.players.find(p=>p.id===S.playerId);
    if(pl){pl.streak=0;S.streak=0}
    if(!room.answers[S.currentQ])room.answers[S.currentQ]=[];
    room.answers[S.currentQ].push({pid:S.playerId,oi:-1,time:TIME_PER_Q,ok:false,pts:0});
    saveRoom(room); bcast('player-answered');
    const fb=document.getElementById('pq-feedback'); fb.classList.remove('hidden');
    fb.innerHTML=`<div class="feedback-content"><div class="feedback-icon">⏰</div>
    <div class="feedback-text" style="color:var(--neon-yellow)">¡Tiempo agotado!</div></div>`;
}

// ═══════════ RESULTADOS — PROFESOR ═══════════
function showTeacherResults(){
    clearInterval(S.timerIv); clearInterval(teacherPoll);
    const room=getRoom(S.roomCode); if(!room)return;
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
    const room=getRoom(S.roomCode); if(!room)return;
    const ans=room.answers[S.currentQ]||[];
    const my=ans.find(a=>a.pid===S.playerId);
    const ok=my&&my.ok;
    document.getElementById('pr-icon').textContent=ok?'🎉':'💪';
    document.getElementById('pr-title').textContent=ok?'¡Excelente!':'¡Sigue intentando!';
    document.getElementById('pr-title').style.color=ok?'var(--success)':'var(--neon-yellow)';
    document.getElementById('pr-points').textContent=S.score+' pts totales';
    document.getElementById('pr-streak').textContent=S.streak>=2?`🔥 Racha de ${S.streak}`:'';
    showScreen('screen-player-result');
    startPlayerWait();
}
function startPlayerWait(){
    if(playerWaitPoll)clearInterval(playerWaitPoll);
    playerWaitPoll=setInterval(()=>{
        const room=getRoom(S.roomCode); if(!room)return;
        if(room.currentQ>S.currentQ){clearInterval(playerWaitPoll);S.answered=false;showPlayerQ(room.currentQ)}
        if(room.gameOver){clearInterval(playerWaitPoll);showFinal()}
    },500);
}

// ═══════════ SIGUIENTE PREGUNTA ═══════════
function nextQuestion(){
    const room=getRoom(S.roomCode); if(!room)return;
    const nq=S.currentQ+1;
    if(nq>=room.qOrder.length){
        room.gameOver=true; saveRoom(room); bcast('game-over'); showFinal(); return;
    }
    room.currentQ=nq; saveRoom(room);
    bcast('next-question',{qi:nq}); showTeacherQ(nq);
}

// ═══════════ PANTALLA FINAL ═══════════
function showFinal(){
    clearInterval(S.timerIv); clearInterval(teacherPoll);
    clearInterval(lobbyPoll); clearInterval(playerWaitPoll);
    const room=getRoom(S.roomCode); if(!room)return;
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
    if(S.roomCode) rmRoom(S.roomCode);
    if(channel) channel.close();
    [S.timerIv,lobbyPoll,teacherPoll,playerWaitPoll].forEach(v=>clearInterval(v));
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

    // Mouse interaction — track position
    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    document.addEventListener('mouseleave', () => { mouseX = -1000; mouseY = -1000; });

    function draw(){
        ctx.fillStyle = 'rgba(10, 14, 26, 0.06)';
        ctx.fillRect(0, 0, W, H);

        for(let i = 0; i < cols; i++){
            const x = i * fontSize;
            const y = drops[i] * fontSize;

            // Mouse repulsion effect
            const dx = x - mouseX;
            const dy = y - mouseY;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if(dist < mouseRadius){
                // Glow brighter near mouse
                const intensity = 1 - dist / mouseRadius;
                const g = Math.floor(200 + 55 * intensity);
                const b = Math.floor(100 * intensity);
                ctx.fillStyle = `rgba(0, ${g}, ${b}, ${0.9 + intensity * 0.1})`;
                ctx.font = `bold ${fontSize + Math.floor(intensity * 4)}px monospace`;
            } else {
                // Normal green with random brightness
                const brightness = Math.random() * 0.5 + 0.3;
                ctx.fillStyle = `rgba(0, ${Math.floor(212 * brightness)}, ${Math.floor(255 * brightness * 0.5)}, ${brightness})`;
                ctx.font = `${fontSize}px monospace`;
            }

            const char = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(char, x, y);

            // Reset drop
            if(y > H && Math.random() > 0.975){
                drops[i] = 0;
            }
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
            // Pre-fill the code and go to join screen
            document.getElementById('input-room-code').value = code;
            // Small delay to ensure localStorage is synced
            setTimeout(()=>{
                showScreen('screen-join');
            }, 300);
        }
        // Clean the hash
        history.replaceState(null, '', location.href.split('#')[0]);
    }
});
