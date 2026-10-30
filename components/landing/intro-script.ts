/** sessionStorage key: the intro plays once per browser session. */
export const SEEN_KEY = "dm.intro.v1";
/** The outro (fill completes, pen underlines, sheet lifts) and the faster skip, in ms. Match globals.css. */
export const OUTRO_MS = 1150;
export const SKIP_MS = 450;
/** The overlay shows for at least 1.5s (no flicker) and is gone by 4s. */
export const OUTRO_FROM_MS = 1500 - OUTRO_MS;
export const OUTRO_BY_MS = 4000 - OUTRO_MS;

/**
 * Runs before first paint. It sets html[data-intro] only when the intro should
 * play: not with reduced motion, not twice in a session (every load when
 * storage is blocked). CSS shows the overlay for that attribute, so with
 * scripting off there is none. The outro starts when the window has loaded,
 * clamped to the times above; any click or key skips straight to the lift.
 */
export const INTRO_SCRIPT = `(function(){
var h=document.documentElement;
try{
if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
try{if(sessionStorage.getItem("${SEEN_KEY}"))return;sessionStorage.setItem("${SEEN_KEY}","1")}catch(e){}
h.setAttribute("data-intro","on");
var t0=performance.now(),done=false,wait,cap;
function end(skip){
if(done)return;done=true;clearTimeout(wait);clearTimeout(cap);
removeEventListener("load",loaded);removeEventListener("pointerdown",onSkip,true);removeEventListener("keydown",onSkip,true);
h.setAttribute("data-intro",skip?"skip":"lift");
setTimeout(function(){h.removeAttribute("data-intro")},skip?${SKIP_MS}:${OUTRO_MS});
}
function onSkip(){end(true)}
function loaded(){wait=setTimeout(end,Math.max(0,${OUTRO_FROM_MS}-(performance.now()-t0)))}
addEventListener("pointerdown",onSkip,true);addEventListener("keydown",onSkip,true);
cap=setTimeout(end,${OUTRO_BY_MS});
if(document.readyState==="complete")loaded();else addEventListener("load",loaded);
}catch(e){h.removeAttribute("data-intro")}
})();`;
