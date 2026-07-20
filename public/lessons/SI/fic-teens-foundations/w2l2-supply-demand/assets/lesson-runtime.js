/* fta-lesson-runtime.js — SHARED interactive runtime for FTA HTML lessons (v3).
 * Canonical source: component_library/lesson-template/lesson-runtime.js
 * Drives: audio player + section auto-advance, per-section platform emits (ftaBridge),
 * continue-gating on interactive anchors, cinematic video that PAUSES narration,
 * click-to-sort mini-game, graded quiz + quiz_answer emit, lesson complete.
 * All controllers are id-driven and lesson-agnostic; each no-ops when its nodes are absent.
 *
 * Requires in the page:  #progressBar #lessonAudio #playBtn #spd #seek #curTime #durTime
 *   #secLabel #dots #contWrap #contBtn #startBtn ; window.sectionTimestamps ; ftaBridge.js
 *
 * GATING MODEL (v3, non-trapping):
 *   - Any section with interactive:true pauses the narration at its end and shows Continue.
 *   - Continue is DISABLED only while that section id is a *pending gate*.
 *   - A section becomes a pending gate when a controller (or lesson code) registers it via
 *     window.__ftaRegisterGate(id[, hint]); it clears via window.__ftaSatisfy(id).
 *   - Built-in controllers (cinematic / sorter / quiz) auto-register + auto-satisfy their own
 *     section (resolved from the nearest ancestor <section id>). An interactive section with no
 *     registered gate simply pauses (Continue enabled immediately) — it can never trap the user.
 *   - A lesson's own interactive component (slider, builder, game) can gate by calling
 *     window.__ftaRegisterGate('section-id','Do the thing to continue') on init and
 *     window.__ftaSatisfy('section-id') when the learner finishes.
 *
 * ftaBridge emits (each guarded by if(window.ftaBridge); ready() auto-fires, never called here):
 *   section({id,index,total,progress_pct})  once per anchor activation
 *   quizAnswer({score,passed,total,correct,answers:[{question,selected,correct_index,is_correct}]}) once
 *   complete({})  once at the end
 */
(function(){
  'use strict';
  var ST=window.sectionTimestamps, TOTAL=ST.length;
  var reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var audio=document.getElementById('lessonAudio');
  var playBtn=document.getElementById('playBtn'), spd=document.getElementById('spd');
  var seek=document.getElementById('seek'), curT=document.getElementById('curTime'), durT=document.getElementById('durTime');
  var secLabel=document.getElementById('secLabel'), progressBar=document.getElementById('progressBar');
  var contWrap=document.getElementById('contWrap'), contBtn=document.getElementById('contBtn');
  var dots=document.getElementById('dots');
  var PLAY='▶', PAUSE='⏸', speeds=[0.75,1,1.25], sIdx=1;
  var curIdx=-1, waiting=false, emitted={};
  var pending={};          // sectionId -> true while gate is unsatisfied
  var gateHintText={};     // sectionId -> custom Continue label while gated

  function fmt(s){s=s||0;var m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+(x<10?'0':'')+x;}
  function progressPct(i){return Math.round(((i+1)/TOTAL)*100);}
  function idxOf(id){for(var i=0;i<ST.length;i++){if(ST[i].id===id) return i;}return -1;}
  function sectionIdOf(el){var s=el&&el.closest?el.closest('section[id]'):null;return s?s.id:null;}

  /* ---------- nav dots ---------- */
  ST.forEach(function(s,i){
    var d=document.createElement('div'); d.className='dot'; d.dataset.i=i;
    d.innerHTML='<span class="dl">'+(s.label||('Section '+(i+1)))+'</span>';
    d.addEventListener('click',function(){goTo(i,true);});
    dots.appendChild(d);
  });
  var dotEls=dots.querySelectorAll('.dot');

  function setActive(idx){
    if(idx===curIdx) return; curIdx=idx; var s=ST[idx];
    secLabel.textContent=s.label||'';
    dotEls.forEach(function(d,i){d.classList.toggle('active',i===idx);d.classList.toggle('done',i<idx);});
    var el=document.getElementById(s.id); if(el) el.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
    document.dispatchEvent(new CustomEvent('fta:section',{detail:{id:s.id,index:idx}}));
    if(!emitted[idx]){emitted[idx]=true; if(window.ftaBridge) window.ftaBridge.section({id:s.id,index:idx,total:TOTAL,progress_pct:progressPct(idx)});}
  }

  function showCont(idx){
    waiting=true; var s=ST[idx];
    var gated=s.interactive && pending[s.id];
    contWrap.style.display='block';
    if(gated){contBtn.disabled=true; contBtn.textContent=gateHintText[s.id]||'Finish this step to continue';}
    else{contBtn.disabled=false; contBtn.textContent=s.interactive?'Done — Continue →':'Continue →';}
  }
  function hideCont(){waiting=false; contWrap.style.display='none';}

  /* public gate API */
  window.__ftaRegisterGate=function(id,hint){ if(idxOf(id)<0) return; pending[id]=true; if(hint) gateHintText[id]=hint; };
  window.__ftaSatisfy=function(id){
    pending[id]=false;
    if(waiting && curIdx>=0 && ST[curIdx].id===id){contBtn.disabled=false; contBtn.textContent='Done — Continue →';}
  };

  function goTo(idx,fromClick){hideCont(); setActive(idx); audio.currentTime=ST[idx].start; if(fromClick){audio.play(); playBtn.textContent=PAUSE;}}
  window.__ftaGoTo=goTo;

  /* ---------- transport ---------- */
  playBtn.addEventListener('click',function(){
    if(audio.paused){if(curIdx<0) setActive(0); audio.play(); playBtn.textContent=PAUSE;}
    else{audio.pause(); playBtn.textContent=PLAY;}
  });
  spd.addEventListener('click',function(){sIdx=(sIdx+1)%speeds.length; audio.playbackRate=speeds[sIdx]; spd.textContent=speeds[sIdx]+'x';});
  audio.addEventListener('loadedmetadata',function(){durT.textContent=fmt(audio.duration); seek.max=audio.duration;});
  audio.addEventListener('timeupdate',function(){
    curT.textContent=fmt(audio.currentTime); seek.value=audio.currentTime;
    if(audio.duration) progressBar.style.width=(audio.currentTime/audio.duration*100)+'%';
    if(waiting) return;
    var t=audio.currentTime, cur=0;
    for(var i=ST.length-1;i>=0;i--){if(t>=ST[i].start){cur=i; break;}}
    if(cur!==curIdx) setActive(cur);
    var s=ST[cur];
    if(s.interactive && t>=s.end-0.12){audio.pause(); playBtn.textContent=PLAY; showCont(cur);}
  });
  seek.addEventListener('input',function(){audio.currentTime=parseFloat(seek.value);});
  contBtn.addEventListener('click',function(){
    if(contBtn.disabled) return; hideCont();
    var n=curIdx+1;
    if(n<TOTAL){setActive(n); audio.currentTime=ST[n].start; audio.play(); playBtn.textContent=PAUSE;}
    else{finishLesson();}
  });
  audio.addEventListener('ended',function(){playBtn.textContent=PLAY; finishLesson();});
  var startBtn=document.getElementById('startBtn');
  if(startBtn) startBtn.addEventListener('click',function(){setActive(0); audio.currentTime=0; audio.play(); playBtn.textContent=PAUSE;});

  /* ---------- scroll-in animations ---------- */
  var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting) e.target.classList.add('vis');});},{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.anim').forEach(function(el){io.observe(el);});

  /* ---------- cinematic video: pause narration, coach outro, satisfy gate ---------- */
  (function(){
    var vid=document.getElementById('cineVid')||document.getElementById('compVid');
    var ov=document.getElementById('cineOv')||document.getElementById('compOv');
    var outro=document.getElementById('cvOutro');
    if(!vid||!ov) return;
    var secId=sectionIdOf(vid), sIdx2=idxOf(secId);
    if(secId && ST[sIdx2] && ST[sIdx2].interactive){ window.__ftaRegisterGate(secId,'Play the clip to continue'); }
    var wasPlaying=false;
    function done(){
      if(outro) outro.style.display='block';
      if(secId) window.__ftaSatisfy(secId);
      if(wasPlaying && sIdx2>=0 && audio.currentTime<ST[sIdx2].end-0.3){audio.play(); playBtn.textContent=PAUSE;}
    }
    ov.addEventListener('click',function(){
      wasPlaying=!audio.paused;
      if(!audio.paused){audio.pause(); playBtn.textContent=PLAY;}
      ov.classList.add('hide');
      var p=vid.play(); if(p&&p.catch) p.catch(function(){});
    });
    vid.addEventListener('ended',done);
    vid.addEventListener('error',function(){ov.classList.add('hide'); done();}); // never trap if the clip fails
  })();

  /* ---------- click-to-sort mini-game ---------- */
  (function(){
    var pool=document.getElementById('pool'), fb=document.getElementById('sorterFb');
    if(!pool) return;
    var secId=sectionIdOf(pool), sIdx3=idxOf(secId);
    if(secId && ST[sIdx3] && ST[sIdx3].interactive){ window.__ftaRegisterGate(secId,'Sort every item to continue'); }
    var cols=pool.parentNode.querySelectorAll('.col');
    var chips=Array.prototype.slice.call(pool.querySelectorAll('.chip'));
    var N=chips.length, placed=0, correct=0, selected=null;
    function arm(on){cols.forEach(function(c){c.classList.toggle('armed',on);});}
    chips.forEach(function(chip){
      chip.addEventListener('click',function(){
        if(chip.classList.contains('ok')||chip.classList.contains('no')) return;
        if(selected===chip){chip.classList.remove('sel'); selected=null; arm(false); return;}
        chips.forEach(function(c){c.classList.remove('sel');});
        chip.classList.add('sel'); selected=chip; arm(true);
        if(fb) fb.textContent='Now tap the column where "'+chip.textContent+'" belongs.';
      });
    });
    cols.forEach(function(col){
      col.addEventListener('click',function(){
        if(!selected) return;
        var right=selected.dataset.bucket===col.dataset.bucket;
        var drop=col.querySelector('.drop');
        selected.classList.remove('sel'); selected.disabled=true;
        selected.classList.add(right?'ok':'no');
        drop.appendChild(selected);
        placed++; if(right) correct++; selected=null; arm(false);
        if(placed<N){ if(fb) fb.textContent='Sorted '+placed+' of '+N+'.'; }
        else{ pool.classList.add('empty'); if(fb){fb.classList.add('done'); fb.textContent='All sorted — you matched '+correct+' of '+N+'.';} if(secId) window.__ftaSatisfy(secId); }
      });
    });
  })();

  /* ---------- graded quiz + bridge emit ---------- */
  (function(){
    var box=document.getElementById('quizBox'); if(!box) return;
    var secId=sectionIdOf(box), sIdx4=idxOf(secId);
    if(secId && ST[sIdx4] && ST[sIdx4].interactive){ window.__ftaRegisterGate(secId,'Submit the quiz to continue'); }
    var qs=Array.prototype.slice.call(box.querySelectorAll('.q'));
    var submit=document.getElementById('quizSubmit');
    var sel={}, graded=false;
    qs.forEach(function(q,qi){
      var opts=q.querySelectorAll('.opt');
      opts.forEach(function(opt){opt.addEventListener('click',function(){if(graded) return; opts.forEach(function(o){o.classList.remove('sel');}); opt.classList.add('sel'); sel[qi]=parseInt(opt.dataset.idx,10);});});
    });
    submit.addEventListener('click',function(){
      if(graded) return; graded=true;
      var total=qs.length, correct=0, answers=[];
      qs.forEach(function(q,qi){
        var corr=parseInt(q.getAttribute('data-correct'),10);
        var s=(qi in sel)?sel[qi]:null, isC=s===corr; if(isC) correct++;
        var opts=q.querySelectorAll('.opt');
        opts.forEach(function(o,i){o.disabled=true; if(i===corr) o.classList.add('correct'); if(i===s&&i!==corr) o.classList.add('wrong');});
        var exp=q.querySelector('.exp'); if(exp) exp.style.display='block';
        answers.push({question:q.querySelector('h4').textContent.replace(/^\d+\.\s*/,''),selected:s,correct_index:corr,is_correct:isC});
      });
      var score=Math.round((correct/total)*100), passed=score>=60;
      var res=document.getElementById('quizResult'); if(res) res.style.display='block';
      var sc=document.getElementById('quizScore'); if(sc) sc.textContent=correct+' / '+total;
      var msg=document.getElementById('quizMsg');
      if(msg) msg.textContent = passed ? (correct===total?'Perfect — you\'ve got it nailed down.':'Nice work. Review anything you missed above.') : 'Close. Scroll back through the sections and give it another look.';
      submit.style.display='none';
      if(window.ftaBridge) window.ftaBridge.quizAnswer({score:score,passed:passed,total:total,correct:correct,answers:answers});
      if(secId) window.__ftaSatisfy(secId);
      document.dispatchEvent(new CustomEvent('fta:quizDone',{detail:{score:score,passed:passed}}));
    });
  })();

  /* ---------- lesson complete ---------- */
  var finishBtn=document.getElementById('finishBtn'), doneChip=document.getElementById('doneChip'), completed=false;
  function finishLesson(){
    if(completed) return; completed=true;
    if(window.ftaBridge) window.ftaBridge.complete({});
    if(finishBtn) finishBtn.style.display='none';
    if(doneChip) doneChip.style.display='inline-flex';
    if(progressBar) progressBar.style.width='100%';
  }
  if(finishBtn) finishBtn.addEventListener('click',finishLesson);
  document.addEventListener('fta:reachedEnd',finishLesson);
  window.__ftaComplete=finishLesson;
})();
