/* ftaBridge.js — tiny lesson→platform SDK for FTA interactive HTML lessons.
 *
 * Protocol (child iframe -> parent dashboard viewer):
 *   { type:'fta', event:'ready'|'section'|'quiz_answer'|'complete', payload:{...}, ctx:{...}, v:1, ts:<ms> }
 *
 *   ready        payload: {}                          fired once on load so the host can begin listening
 *   section      payload: { id, index, total, progress_pct }        host -> lesson_progress (in_progress + pct)
 *   quiz_answer  payload: { score, passed, total, correct, answers:[{question,selected,correct_index,is_correct}] }
 *                                                     host -> insert quiz_attempts + award quiz XP
 *   complete     payload: {}                          host -> lesson_progress completed + award lesson XP
 *
 * Security model: the child posts with targetOrigin '*' because these events carry no secrets.
 * The PARENT is responsible for validating event.origin against its allowlist before acting.
 * When the lesson is opened standalone (not in an iframe) every emit is a harmless no-op that is
 * still recorded on window.__ftaBridgeLog for debugging.
 */
(function () {
  'use strict';
  var TYPE = 'fta';
  var VERSION = 1;
  var inIframe = (function () { try { return window.parent && window.parent !== window; } catch (e) { return false; } })();

  function meta(name) {
    var m = document.querySelector('meta[name="' + name + '"]');
    return m ? (m.getAttribute('content') || '') : '';
  }

  var ctx = {
    course: meta('fta-course'),
    module: meta('fta-module'),
    lesson: meta('fta-lesson'),
    title: meta('fta-lesson-title')
  };

  function post(event, payload) {
    var msg = { type: TYPE, v: VERSION, event: event, payload: payload || {}, ctx: ctx, ts: Date.now() };
    try { window.__ftaBridgeLog = window.__ftaBridgeLog || []; window.__ftaBridgeLog.push(msg); } catch (e) {}
    if (inIframe) { try { window.parent.postMessage(msg, '*'); } catch (e) {} }
    return msg;
  }

  var completed = false;

  window.ftaBridge = {
    inIframe: inIframe,
    ready: function () { return post('ready', {}); },
    section: function (p) { return post('section', p || {}); },
    quizAnswer: function (p) { return post('quiz_answer', p || {}); },
    complete: function (p) {
      if (completed) return null;      // idempotent: fire once
      completed = true;
      return post('complete', p || {});
    }
  };

  function announce() { window.ftaBridge.ready(); }
  if (document.readyState !== 'loading') announce();
  else document.addEventListener('DOMContentLoaded', announce);
})();
