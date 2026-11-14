/** Only properties used by the printed dictionary, avoiding hundreds of unused CSS properties per node. */
export const dictionaryCaptureStyles = [
  'display','position','top','right','bottom','left','z-index','box-sizing','width','height','min-width','min-height','max-width','max-height',
  'margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left',
  'overflow','overflow-x','overflow-y','opacity','visibility','isolation',
  'color','background-color','background-image','background-size','background-position','background-repeat',
  'border-top','border-right','border-bottom','border-left','border-radius','box-shadow',
  'font-family','font-size','font-weight','font-style','line-height','letter-spacing','word-spacing','white-space','word-break','overflow-wrap',
  'text-align','text-indent','text-transform','text-decoration','text-underline-offset','text-overflow','vertical-align',
  'flex','flex-direction','flex-wrap','align-items','align-self','justify-content','gap','order','grid-template-columns','grid-template-rows',
  'column-width','column-count','column-gap','column-fill','break-before','break-after','break-inside','orphans','widows',
  'transform','transform-origin','object-fit','object-position','list-style','content','appearance',
  'fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule',
];
