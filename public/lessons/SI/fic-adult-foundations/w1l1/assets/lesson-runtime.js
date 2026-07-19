/* fta-lesson-runtime.js — SHARED interactive runtime for FTA HTML lessons.
 * Canonical source: component_library/lesson-template/lesson-runtime.js
 * Drives: audio player + section auto-advance, per-section platform emits (ftaBridge),
 * inline video autoplay, click-to-sort exercise, graded quiz + quiz_answer emit, complete.
 * All controllers are id-driven and lesson-agnostic. Requires (in <head>/<body>):
 *   #progressBar #lessonAudio #playBtn #spd #seek #curTime #durTime #secLabel #dots
 *   #contWrap #contBtn #startBtn ; window.sectionTimestamps ; window.ftaBridge (ftaBridge.js)
 * Optional per-section modules no-op when their nodes are absent:
 *   compounding video (#compVid/#compOv), sorter (#pool/.col/.chip), quiz (#quizBox/#quizSubmit),
 *   complete (#finishBtn/#doneChip). */
/* ---------- Audio controller + section bridge ---------- */
(function(){
  'use strict';
  var ST = window.sectionTimestamps, TOTAL = ST.length;
  var audio=document.getElementById('lessonAudio');
  var playBtn=document.getElementById('playBtn'), spd=document.getElementById('spd');
  var seek=document.getElementById('seek'), curT=document.getElementById('curTime'), durT=document.getElementById('durTime');
  var secLabel=document.getElementById('secLabel'), progressBar=document.getElementById('progressBar');
  var contWrap=document.getElementById('contWrap'), contBtn=document.getElementById('contBtn');
  var speeds=[0.75,1,1.25,1.5], sIdx=1;
  var curIdx=-1, waiting=false, emitted={};
  var PLAY='▶', PAUSE='⏸';

  function fmt(s){s=s||0;var m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+(x<10?'0':'')+x;}
  function progressPct(idx){return Math.round(((idx+1)/TOTAL)*100);}

  // build nav dots
  var dots=document.getElementById('dots');
  ST.forEach(function(s,i){
    var d=document.createElement('div'); d.className='dot'; d.dataset.i=i;
    d.innerHTML='<span class="dl">'+s.label+'</span>';
    d.addEventListener('click',function(){ goTo(i,true); });
    dots.appendChild(d);
  });
  var dotEls=dots.querySelectorAll('.dot');

  function setActive(idx){
    if(idx===curIdx) return;
    curIdx=idx;
    var s=ST[idx];
    secLabel.textContent=s.label;
    progressBar.style.width=progressPct(idx)+'%';
    dotEls.forEach(function(d,i){ d.classList.toggle('active', i===idx); });
    var el=document.getElementById(s.id); if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
    document.dispatchEvent(new CustomEvent('fta:section',{detail:{id:s.id,index:idx}}));
    if(!emitted[idx]){ emitted[idx]=true;
      window.ftaBridge && window.ftaBridge.section({id:s.id,index:idx,total:TOTAL,progress_pct:progressPct(idx)});
    }
  }
  function goTo(idx,fromClick){
    hideCont();
    setActive(idx);
    audio.currentTime=ST[idx].start;
    if(fromClick){ audio.play(); playBtn.textContent=PAUSE; }
  }
  function showCont(interactive){ waiting=true; contBtn.textContent=interactive?'Done — Continue':'Continue'; contWrap.style.display='block'; }
  function hideCont(){ waiting=false; contWrap.style.display='none'; }

  window.__ftaGoTo=goTo; // exposed for other controllers / tests

  playBtn.addEventListener('click',function(){
    if(audio.paused){ if(curIdx<0) setActive(0); audio.play(); playBtn.textContent=PAUSE; }
    else{ audio.pause(); playBtn.textContent=PLAY; }
  });
  spd.addEventListener('click',function(){ sIdx=(sIdx+1)%speeds.length; audio.playbackRate=speeds[sIdx]; spd.textContent=speeds[sIdx]+'x'; });
  audio.addEventListener('loadedmetadata',function(){ durT.textContent=fmt(audio.duration); seek.max=audio.duration; });
  audio.addEventListener('timeupdate',function(){
    curT.textContent=fmt(audio.currentTime); seek.value=audio.currentTime;
    if(waiting) return;
    var t=audio.currentTime, cur=0;
    for(var i=ST.length-1;i>=0;i--){ if(t>=ST[i].start){ cur=i; break; } }
    if(cur!==curIdx) setActive(cur);
    if(t>=ST[cur].end-0.25){ audio.pause(); playBtn.textContent=PLAY; showCont(ST[cur].interactive||false); }
  });
  seek.addEventListener('input',function(){ audio.currentTime=parseFloat(seek.value); });
  contBtn.addEventListener('click',function(){
    hideCont();
    var n=curIdx+1;
    if(n<TOTAL){ setActive(n); audio.currentTime=ST[n].start; audio.play(); playBtn.textContent=PAUSE; }
    else{ document.dispatchEvent(new CustomEvent('fta:reachedEnd')); }
  });
  audio.addEventListener('ended',function(){ playBtn.textContent=PLAY; document.dispatchEvent(new CustomEvent('fta:reachedEnd')); });

  document.getElementById('startBtn').addEventListener('click',function(){
    setActive(0); audio.currentTime=0; audio.play(); playBtn.textContent=PAUSE;
    var c=document.getElementById('what-investing-is');
  });

  // scroll-in animations
  var io=new IntersectionObserver(function(en){ en.forEach(function(e){ if(e.isIntersecting) e.target.classList.add('vis'); }); },{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.anim').forEach(function(el){ io.observe(el); });
})();

/* ---------- Compounding video: autoplay muted when section active ---------- */
(function(){
  var vid=document.getElementById('compVid'), ov=document.getElementById('compOv');
  if(!vid) return;
  ov.addEventListener('click',function(){ ov.classList.add('hide'); vid.play(); });
  vid.addEventListener('play',function(){ ov.classList.add('hide'); });
  document.addEventListener('fta:section',function(e){
    if(e.detail && e.detail.id==='compounding'){ try{ vid.currentTime=0; vid.play(); }catch(err){} }
  });
})();

/* ---------- Goals sorter ---------- */
(function(){
  var pool=document.getElementById('pool'), fb=document.getElementById('sorterFb');
  var cols=document.querySelectorAll('.col');
  var chips=Array.prototype.slice.call(pool.querySelectorAll('.chip'));
  var TOTALc=chips.length, placed=0, correct=0, selected=null;

  function arm(on){ cols.forEach(function(c){ c.classList.toggle('armed', on); }); }
  chips.forEach(function(chip){
    chip.addEventListener('click',function(){
      if(chip.classList.contains('ok')||chip.classList.contains('no')) return;
      if(selected===chip){ chip.classList.remove('sel'); selected=null; arm(false); return; }
      chips.forEach(function(c){ c.classList.remove('sel'); });
      chip.classList.add('sel'); selected=chip; arm(true);
      fb.textContent='Now tap the column where "'+chip.textContent+'" belongs.';
    });
  });
  cols.forEach(function(col){
    col.addEventListener('click',function(){
      if(!selected) return;
      var right = selected.dataset.bucket===col.dataset.bucket;
      var drop = col.querySelector('.drop');
      selected.classList.remove('sel'); selected.disabled=true;
      selected.classList.add(right?'ok':'no');
      drop.appendChild(selected);
      placed++; if(right) correct++;
      selected=null; arm(false);
      if(placed<TOTALc){ fb.textContent='Sorted '+placed+' of '+TOTALc+'.'; }
      else{
        pool.classList.add('empty');
        fb.classList.add('done');
        fb.textContent='All sorted — you matched '+correct+' of '+TOTALc+'. Investing is a long game measured in years.';
        var cw=document.getElementById('contWrap');
        if(cw && cw.style.display==='none'){ /* leave audio flow intact */ }
      }
    });
  });
})();

/* ---------- Quiz grading + bridge emit ---------- */
(function(){
  var box=document.getElementById('quizBox');
  var qs=Array.prototype.slice.call(box.querySelectorAll('.q'));
  var submit=document.getElementById('quizSubmit');
  var selectedIdx={}, graded=false;

  qs.forEach(function(q,qi){
    var opts=q.querySelectorAll('.opt');
    opts.forEach(function(opt){
      opt.addEventListener('click',function(){
        if(graded) return;
        opts.forEach(function(o){ o.classList.remove('sel'); });
        opt.classList.add('sel');
        selectedIdx[qi]=parseInt(opt.dataset.idx,10);
      });
    });
  });

  submit.addEventListener('click',function(){
    if(graded) return; graded=true;
    var total=qs.length, correct=0, answers=[];
    qs.forEach(function(q,qi){
      var corr=parseInt(q.getAttribute('data-correct'),10);
      var sel=(qi in selectedIdx)?selectedIdx[qi]:null;
      var isC = sel===corr;
      if(isC) correct++;
      var opts=q.querySelectorAll('.opt');
      opts.forEach(function(o,i){
        o.disabled=true;
        if(i===corr) o.classList.add('correct');
        if(i===sel && i!==corr) o.classList.add('wrong');
      });
      q.querySelector('.exp').style.display='block';
      answers.push({
        question:q.querySelector('h4').textContent.replace(/^\d+\.\s*/,''),
        selected:sel, correct_index:corr, is_correct:isC
      });
    });
    var score=Math.round((correct/total)*100);
    var passed=score>=70;
    var res=document.getElementById('quizResult'); res.style.display='block';
    document.getElementById('quizScore').textContent=correct+' / '+total;
    document.getElementById('quizMsg').textContent = passed
      ? (correct===total?'Perfect — you\'ve got the why nailed down.':'Nice work. Review anything you missed above.')
      : 'Close. Scroll back through the sections and give it another look.';
    submit.style.display='none';
    // emit to platform
    window.ftaBridge && window.ftaBridge.quizAnswer({score:score,passed:passed,total:total,correct:correct,answers:answers});
    document.dispatchEvent(new CustomEvent('fta:quizDone',{detail:{score:score,passed:passed}}));
  });
})();

/* ---------- Lesson complete ---------- */
(function(){
  var finishBtn=document.getElementById('finishBtn'), doneChip=document.getElementById('doneChip');
  function complete(){
    window.ftaBridge && window.ftaBridge.complete({});
    finishBtn.style.display='none';
    doneChip.style.display='inline-flex';
    var pb=document.getElementById('progressBar'); if(pb) pb.style.width='100%';
  }
  finishBtn.addEventListener('click',complete);
  // auto-complete when narration finishes or the last section is passed via Continue
  document.addEventListener('fta:reachedEnd',complete);
})();
