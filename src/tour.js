export const TOUR_KEY = 'you.checkout.tour.v1';
const STEPS = [
  {title:'Welcome to YOU.', text:'Before you receive or release a Bitcoin payment, understand what you are checking. Let’s take a quick tour.'},
  {title:'Verify', view:'lookup', target:'#lookup h2', text:'Verify a Bitcoin payment before releasing goods or services. Check the transaction, receiving address, expected amount and confirmation status.'},
  {title:'Receive', view:'wallet', target:'#wallet h2', text:'Generate or enter a receiving address, create a payment request and view incoming transactions.'},
  {title:'Send Check', view:'recipient', target:'#recipient h2', text:'Compare a payment address against addresses you have saved. A different address is a reason to pause and check.'},
  {title:'Checklist', view:'checklist', target:'#checklist h2', text:'Before you release goods or services, review the payment details and warning signs.'},
  {title:'Profile and settings', target:'#settings-open', text:'Open Settings from the top right to change the appearance or manage your profile and preferences.'},
  {title:'You’re ready to use YOU.', text:'Use the Demo to practise, or check a payment on a supported test network. Do not use real funds.'}
];

export function initTour({read,write,openView}) {
  const $=id=>document.getElementById(id);
  const layer=$('tour-layer'), intro=$('tour-intro'), panel=$('tour-popover'), spot=$('tour-spotlight');
  const back=$('tour-back'), next=$('tour-next'), skip=$('tour-skip'), title=$('tour-title');
  let step=-1, highlighted, frame=0;
  const last=STEPS.length-1;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');

  function clearSpotlight(){if(highlighted)highlighted.classList.remove('tour-target');highlighted=undefined;}
  function layout(){
    if(step<0)return;
    const vp=window.visualViewport;
    const left=vp?.offsetLeft??0, top=vp?.offsetTop??0;
    const width=vp?.width??document.documentElement.clientWidth, height=vp?.height??innerHeight;
    const right=left+width, bottom=top+height, gap=8;
    panel.style.setProperty('--tour-width',`${Math.max(0,width-2*gap)}px`);
    panel.style.setProperty('--tour-height',`${Math.max(0,height-2*gap)}px`);
    const anchor=highlighted?.getBoundingClientRect();
    const description=highlighted?.nextElementSibling;
    const extra=highlighted?.tagName==='H2'&&description?.matches('p.desc') ? description.getBoundingClientRect() : null;
    const rect=anchor && {left:anchor.left,right:anchor.right,top:anchor.top,bottom:extra?.bottom??anchor.bottom,
      width:anchor.width,height:(extra?.bottom??anchor.bottom)-anchor.top};
    const showSpot=rect&&rect.width>0&&rect.height>0&&rect.bottom>top&&rect.top<bottom&&rect.right>left&&rect.left<right;
    spot.hidden=!showSpot;
    const pw=panel.offsetWidth, ph=panel.offsetHeight;
    let x=left+(width-pw)/2,y=top+(height-ph)/2;
    if(showSpot){
      const sx=Math.max(left+2,rect.left-4), sy=Math.max(top+2,rect.top-4);
      const ex=Math.min(right-2,rect.right+4), ey=Math.min(bottom-2,rect.bottom+4);
      Object.assign(spot.style,{left:`${sx}px`,top:`${sy}px`,width:`${ex-sx}px`,height:`${ey-sy}px`});
      const gapFromTarget=12;
      if(right-ex>=pw+gapFromTarget+gap){x=ex+gapFromTarget;y=sy;}
      else if(sx-left>=pw+gapFromTarget+gap){x=sx-pw-gapFromTarget;y=sy;}
      else if(bottom-ey>=ph+gapFromTarget+gap){x=sx;y=ey+gapFromTarget;}
      else if(sy-top>=ph+gapFromTarget+gap){x=sx;y=sy-ph-gapFromTarget;}
      else {
        const below=bottom-ey, above=sy-top;
        panel.style.setProperty('--tour-height',`${Math.max(36,Math.max(below,above)-gap-gapFromTarget)}px`);
        x=sx;y=below>=above ? ey+gapFromTarget : sy-panel.offsetHeight-gapFromTarget;
      }
    }else if(highlighted){y=bottom-ph-gap;}
    panel.style.left=`${Math.max(left+gap,Math.min(x,right-pw-gap))}px`;
    panel.style.top=`${Math.max(top+gap,Math.min(y,bottom-panel.offsetHeight-gap))}px`;
  }
  function schedule(){if(step<0||frame)return;frame=requestAnimationFrame(()=>{frame=0;layout();});}
  function render(index){
    if(index<0||index>last)return;
    step=index;layer.hidden=false;layer.dataset.tourStep=String(step);
    const item=STEPS[step];
    clearSpotlight();
    if(item.view)openView(item.view);
    if(item.target){
      highlighted=document.querySelector(item.target);
      highlighted.classList.add('tour-target');
      highlighted.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
    }
    title.textContent=item.title;
    $('tour-text').textContent=item.text;
    $('tour-progress').textContent=step===0?'Product tour':`Step ${step} of ${last}`;
    back.hidden=step===0;
    next.textContent=step===0?'Start tour':step===last?'Start using YOU':'Next';
    panel.scrollTop=0;
    layout();title.focus({preventScroll:true});schedule();
  }
  function end(outcome){
    if(step<0)return;
    step=-1;layer.hidden=true;delete layer.dataset.tourStep;clearSpotlight();write(TOUR_KEY,outcome);openView('lookup');
    $('lookup').querySelector('h2').focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
  back.addEventListener('click',()=>render(step-1));
  next.addEventListener('click',()=>{if(step===last)end('complete');else if(step>=0)render(step+1);});
  skip.addEventListener('click',()=>end('skipped'));
  for(const id of ['tour-start','tour-replay'])$(id).addEventListener('click',()=>render(0));
  window.addEventListener('resize',schedule);
  window.addEventListener('scroll',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('scroll',schedule);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&step>=0&&!event.defaultPrevented){event.preventDefault();end('skipped');}
  });
  // Users may still operate the real app. Reposition if a navigation action moves a target.
  document.addEventListener('click',event=>{if(event.target.closest('[data-view],#settings-open,#brand'))schedule();});
  if(!['complete','skipped'].includes(read(TOUR_KEY,null))){
    if(reduced.matches){render(0);return;}
    intro.hidden=false;
    const finish=()=>{if(intro.hidden)return;intro.hidden=true;render(0);};
    intro.addEventListener('animationend',finish,{once:true});
    setTimeout(finish,700);
  }
}
