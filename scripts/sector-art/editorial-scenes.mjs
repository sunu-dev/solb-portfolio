// Industry-specific subjects. Shared primitives are objects, never complete scenes.
const V = (s, origin, axis, outline, depth=2, lit=false) => s.prism({o:origin,a:axis,u:[1,0,0],v:[0,0,1]},outline,0,depth,lit);
const front = (s,x,y,z,outline,depth=2,lit=false) => V(s,[x,y,z],[0,1,0],outline,depth,lit);
function rod(s,a,b,r=1,lit=false){const d=b.map((v,i)=>v-a[i]); const l=Math.hypot(...d);s.turned(a,d.map(v=>v/l),[[0,r],[l,r]],lit);}
function ring(s,o,axis,r,t=2,lit=false){s.turned(o,axis,[[0,r-t],[0,r],[t,r],[t,r-t],[0,r-t]],lit,'hi',true);s.parts.at(-1).hole=[t,r-t];}
function coin(s,x,y,z,r=12){s.round(x,y,r,z,3,true);s.round(x,y,r-3,z+3,.5);}
function coins(s,x,y,n=4){for(let i=0;i<n;i++)coin(s,x,y,i*3.6);}
function document(s,x,y,z=0,w=45,d=52){s.box(x,y,w,d,z,1.5);s.box(x+5,y+6,w*.52,3,z+1.5,.4,true);for(let i=0;i<5;i++)s.box(x+5,y+16+i*6,w-10-(i%2)*8,1,z+1.5,.3,false,'lo');}
function house(s,x,y,z=0,w=55,d=45,h=43){s.box(x,y,w,d,z,h);s.prism({o:[x,y,z+h],a:[0,1,0],u:[1,0,0],v:[0,0,1]},[[-4,0],[w/2,23],[w+4,0]],-3,d+3,true);s.box(x+w*.42,y+d,10,1,z,23,false,'lo');for(const a of [x+7,x+w-17]){s.box(a,y+d,10,1,z+27,10);s.material('glass');}s.box(x+8,y+9,8,8,z+h+8,15);}
function plant(s,x,y,z=0,size=1){s.round(x,y,7*size,z,11*size);rod(s,[x,y,z+11*size],[x,y,z+40*size],1.2*size);for(const side of [-1,1])for(let i=0;i<2;i++){const h=z+(20+i*11)*size;s.poly([[x,y],[x+side*14*size,y-7*size],[x+side*18*size,y],[x+side*8*size,y+4*size]],h,1,true);}}
function chair(s,x,y,z=0){for(const a of [x,x+23])for(const b of [y,y+23])s.box(a,b,3,3,z,23);s.box(x-2,y-2,30,30,z+23,4,true);s.box(x-2,y-2,30,4,z+27,25,true);}
function plate(s,x,y,z=0,r=15){s.round(x,y,r,z,2);s.round(x,y,r-3,z+2,.5);}
function cup(s,x,y,z=0,r=6){ring(s,[x,y,z],[0,0,1],r,1.5);s.round(x,y,r-1,z,10);ring(s,[x+r,y,z+5],[0,1,0],4,1);}
function wheel(s,x,y,z=12,r=12){s.turned([x,y,z],[0,1,0],[[0,r-2],[2,r],[7,r],[9,r-2]]);s.material('rubber');s.turned([x,y+9,z],[0,1,0],[[0,r*.58],[1,r*.58]]);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod(s,[x,y+10,z],[x+Math.cos(a)*r*.45,y+10,z+Math.sin(a)*r*.45],.7);} }
function crate(s,x,y,z=0,w=27,d=24,h=22){s.box(x,y,w,d,z,h);for(let i=0;i<3;i++)s.box(x,y+d,w,1,z+4+i*6,1,false,'lo');s.box(x+w/2-2,y,4,d,z+h,.4,true);}
function roofShop(s,x,y,w=100,d=55,h=58){s.box(x,y,w,d,0,h);for(let a=0;a<3;a++){s.box(x+6+a*(w-12)/3,y+d,(w-18)/3,1,7,35);s.material('glass');}for(let i=0;i<8;i++)s.box(x+i*w/8,y+d-2,w/8,18,h-8,4,i%2===0);s.box(x,y,w,d,h,4);}
function cross(s,x,y,z,size=20){s.box(x+size*.35,y,size*.3,1,z,size,true);s.box(x,y+.5,size,1,z+size*.35,size*.3,true);}
function shield(s,x,y,z=0){front(s,x,y,z,[[0,42],[24,52],[48,42],[45,15],[24,0],[3,15]],5,true);rod(s,[x+11,y+6,z+27],[x+21,y+6,z+17],2);rod(s,[x+21,y+6,z+17],[x+37,y+6,z+35],2);}
function book(s,x,y,z=0,w=30,d=38){s.box(x,y,w,d,z,2,true);s.box(x+2,y+1,w-3,d-2,z+2,6);s.box(x,y,w,d,z+8,2,true);s.box(x,y,2,d,z+2,6,true);}
function loaf(s,x,y,z=0){s.box(x,y,25,15,z,10,true,'hi',6);for(let i=0;i<3;i++)s.box(x+5+i*6,y+3,1,9,z+10,.4);}
function clothing(s,x,y,z=0){front(s,x,y,z,[[0,32],[12,39],[18,35],[24,39],[36,32],[30,20],[25,23],[25,0],[11,0],[11,23],[6,20]],2,true);rod(s,[x+12,y,z+43],[x+18,y,z+47]);rod(s,[x+18,y,z+47],[x+24,y,z+43]);}
function facet(s,x,y,z,r=13,h=12){const polygon=Array.from({length:8},(_,i)=>[x+Math.cos(i*Math.PI/4)*r,y+Math.sin(i*Math.PI/4)*r]);s.poly(polygon,z,h,true);s.cone(x,y,r,z+h,10,true);}
function ship(s,{cargo=false,fish=false,build=false}={}){s.poly([[-86,-24],[56,-24],[91,0],[56,24],[-86,24]],5,22,true);s.box(-78,-19,134,38,27,3);s.box(-74,-15,30,30,30,25);for(let i=0;i<3;i++)s.box(-70+i*8,15,5,1,42,7,false,'lo');s.box(-70,-10,20,20,55,3);if(cargo){for(let i=0;i<3;i++)for(let j=0;j<2;j++){crate(s,-36+i*29,-19+j*20,30,26,18,17);}}if(fish){rod(s,[-27,0,30],[-27,0,84],2);rod(s,[-27,0,76],[35,0,76],2);for(let i=0;i<6;i++)rod(s,[0+i*5,0,75],[8+i*5,20,34],.5);for(let i=0;i<4;i++)rod(s,[i*3, i*5,65-i*9],[30+i*3,i*5,65-i*9],.5);for(let i=0;i<3;i++)crate(s,4+i*17,-13,30,13,20,9);}if(build){for(let i=0;i<5;i++)s.box(-75+i*31,-30,8,60,0,5);rod(s,[65,-37,0],[65,-37,105],3);rod(s,[65,-37,105],[-30,-37,105],3);rod(s,[-20,-37,105],[-20,-37,60],1);}}
const revisions={};
function set(id,parts,draw,caption){revisions[id]={parts,draw,note:'업종의 특징을 보여주는 대표 장면이에요. 개별 기업의 실제 제품이나 시설과는 다를 수 있어요.',...(caption?{caption}:{})};}
set('leisure',['관람차','탑승 객실','놀이 시설'],s=>{
 const cx=-12,cy=0,cz=65,r=47;for(const y of [-12,12]){rod(s,[cx-32,y,0],[cx,y,cz],3);rod(s,[cx+32,y,0],[cx,y,cz],3);}ring(s,[cx,cy,cz],[0,1,0],r,3,true);s.turned([cx,-8,cz],[0,1,0],[[0,6],[18,6]]);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;rod(s,[cx,3,cz],[x,3,z],1.2);s.box(x-8,-7,16,18,z-17,13,i%2===0,'hi',3);s.box(x-6,11,12,.6,z-13,6,false,'lo');rod(s,[x,0,z],[x,0,z-4],1);}
 s.box(58,10,27,25,0,29,true);s.box(55,7,33,31,29,4);s.box(63,35,17,1,11,13,false,'lo');
},'관람차 같은 놀이 시설을 운영해 이용객에게 여가 경험을 제공해요.');
set('mortgage-finance',['담보 주택','대출 계약서','대출 자금'],s=>{house(s,-82,-33,0,58,46,47);document(s,9,-34,0,63,66);for(let i=0;i<3;i++)coins(s,12+i*23,47,3+i);s.round(59,15,7,2,2,true);rod(s,[-14,25,5],[2,25,5],2,true);},'주택을 담보로 한 대출과 부동산 관련 금융자산을 다뤄요.');
set('restaurant',['음식이 놓인 식탁','식기','식당 좌석'],s=>{s.bench(-52,-32,104,64,34);chair(s,-43,-64);chair(s,14,42);for(const x of [-27,28]){plate(s,x,0,38,17);loaf(s,x-11,-7,40);s.box(x-23,-12,2,23,38,1);for(let i=0;i<3;i++)s.box(x-24+i,-15,0.6,5,38,1);s.box(x+21,-13,2,25,38,1);cup(s,x+13,-22,38);}plant(s,77,10,0,1.3);},'음식을 조리하고 식사 공간과 함께 고객에게 제공해요.');
set('jewelry',['보석 반지','목걸이','장신구 진열'],s=>{s.box(-84,-32,76,68,0,8,true,'hi',5);ring(s,[-47,4,38],[0,1,0],23,4,true);front(s,-62,5,61,[[0,12],[7,20],[23,20],[30,12],[15,0]],8,true);for(const [a,b] of [[[0,12],[30,12]],[[7,20],[15,0]],[[23,20],[15,0]]])rod(s,[-62+a[0],14,61+a[1]],[-62+b[0],14,61+b[1]],.5);s.box(15,-24,63,57,0,6);front(s,23,-13,6,[[0,0],[46,0],[38,16],[32,39],[31,54],[15,54],[14,39],[8,16]],14);for(let i=0;i<17;i++){const a=Math.PI+i*Math.PI/16; s.turned([46+Math.cos(a)*15,3,42+Math.sin(a)*23],[0,1,0],[[0,1.5],[1,1.5]],true);}facet(s,46,6,16,4,3);});
set('tobacco',['담배 제품','제품 포장','가공 원료'],s=>{s.box(-60,-21,54,38,0,64,false,'hi',3);s.box(-62,-23,58,42,64,8,true);s.box(-56,17,46,1,15,20,false,'lo');for(let i=0;i<7;i++){const x=10+i*9;s.round(x,7,3,0,65);s.round(x,7,3,65,17,true);}s.poly([[-69,39],[-41,29],[-14,43],[-36,54]],0,1,true);rod(s,[-64,39,2],[-19,44,2],.6);});
set('furniture',['소파','거실 테이블','스탠드 조명'],s=>{for(const x of [-78,-3])for(const y of [-26,15])s.box(x,y,5,5,0,8);s.box(-85,-31,95,56,8,13);s.box(-85,-32,95,10,21,35,true,'hi',4);for(const x of [-85,0])s.box(x,-25,10,49,21,18,true,'hi',4);for(const x of [-73,-38]){s.box(x,-19,32,38,21,7,false,'hi',4);s.box(x,-21,32,8,31,20,false,'hi',4);}s.bench(30,8,51,39,20);book(s,40,15,24,23,24);s.round(61,-33,13,0,3);rod(s,[61,-33,3],[61,-33,72],2);s.turned([61,-33,65],[0,0,1],[[0,19],[20,10]],true);});
set('insurance',['보장 방패','보험 계약','보호 대상 주택'],s=>{house(s,-84,-28,0,45,38,32);shield(s,-20,9,0);document(s,44,-26,0,43,58);});
set('education',['교실 칠판','학생 책상','교재'],s=>{s.box(-79,-37,154,5,36,57,true);s.box(-84,-39,164,9,32,4);for(const x of [-74,65])s.box(x,-35,5,5,0,36);for(let i=0;i<3;i++){s.box(-65,-31.5,35+i*13,1,76-i*12,2);s.box(31+i*10,-31.5,6,1,48,11+i*8);}for(const x of [-70,20]){s.bench(x,5,51,35,22);book(s,x+7,10,26,24,25);chair(s,x+10,46);}});
set('business-services',['업무 일정판','협업 테이블','업무 서류'],s=>{s.box(-80,-34,140,5,39,61);for(const x of [-70,48])s.box(x,-32,4,4,0,39);for(let c=0;c<3;c++)for(let r=0;r<3;r++)s.box(-70+c*42,-28,32,1,47+r*15,10,c===1);s.bench(-47,4,107,44,26);document(s,-29,10,30,34,29);cup(s,35,22,30);chair(s,-30,50);});
set('travel',['여행 가방','항공권','여권'],s=>{s.box(-70,-26,66,45,0,63,true,'hi',8);for(const x of [-58,-20])s.round(x,25,4,0,4);rod(s,[-55,-7,63],[-55,-7,87],2);rod(s,[-20,-7,63],[-20,-7,87],2);rod(s,[-55,-7,87],[-20,-7,87],3);for(const x of [-56,-23])s.box(x,19,3,1,8,47);book(s,16,-14,0,44,55);s.round(38,12,11,10,1);document(s,21,25,12,63,27);});
set('consumer-discretionary',['쇼핑백','신발','생활 소비재'],s=>{s.box(-72,-26,61,40,0,49,true);ring(s,[-43,-8,56],[0,1,0],13,2);s.box(18,-10,67,31,0,12,false,'hi',8);s.box(18,-10,24,31,12,15);for(let i=0;i<4;i++)s.box(38+i*5,-6,2,23,12,1);book(s,-62,33,0,40,36);});
set('consumer-staples',['빵과 식료품','우유 팩','생활용품'],s=>{s.box(-18,-20,32,33,0,47);s.prism({o:[-18,-20,47],a:[0,1,0],u:[1,0,0],v:[0,0,1]},[[0,0],[16,13],[32,0]],0,33,true);s.box(-12,13,20,1,9,23,true);loaf(s,-75,3,0);loaf(s,-69,19,0);s.round(52,2,17,0,42);s.round(52,2,7,42,6);s.box(46,-1,30,5,48,4,true);plate(s,35,48,0,17);});
set('retail',['매장 입구','차양','상품 진열'],s=>{roofShop(s,-83,-37,115,57,64);s.box(51,6,32,34,0,29);for(let i=0;i<3;i++)s.bottle(57+i*10,18,29,3,12,i===1);plant(s,-94,34,0,.7);});
set('warehouse',['물류창고 선반','포장 상자','운반 카트'],s=>{for(const x of [-85,-10])for(const y of [-34,-5])s.box(x,y,4,4,0,81);for(const z of [0,28,56]){s.box(-85,-34,79,33,z,3);for(let i=0;i<2;i++)crate(s,-80+i*36,-30,z+3,29,25,22);}s.box(17,9,68,38,6,4);for(const x of [26,73])for(const y of [11,38])s.round(x,y,4,0,6);crate(s,24,13,10,48,28,34);rod(s,[83,10,10],[83,10,53],2);rod(s,[83,44,10],[83,44,53],2);rod(s,[83,10,53],[83,44,53],2);});
set('medical-supplies',['주사기','붕대','의료 용품 상자'],s=>{s.box(-80,-31,65,58,0,43);cross(s,-63,28,12,25);for(let i=0;i<3;i++){s.round(16+i*23,-9,8,0,32);s.round(16+i*23,-9,3,32,1,false,'lo');}s.turned([11,37,7],[1,0,0],[[0,5],[41,5]]);s.turned([52,37,7],[1,0,0],[[0,2],[15,2]]);rod(s,[67,37,7],[86,37,7],.5);for(let i=0;i<7;i++)s.box(16+i*4,33,1,1,11,1,true);});
set('pharmacy',['약국','의약품 진열','약국 표지'],s=>{roofShop(s,-78,-33,117,55,63);cross(s,-37,25,63,24);for(let i=0;i<3;i++){s.bottle(57, -20+i*25,0,9,23,i===1);s.box(51,-11+i*25,12,.5,8,8,true);} });
set('apparel',['옷걸이와 의류','의류 행거','접힌 옷'],s=>{for(const x of [-81,29]){s.box(x,-25,6,35,0,3);rod(s,[x+3,-8,3],[x+3,-8,91],2);}rod(s,[-78,-8,91],[32,-8,91],2);for(let i=0;i<3;i++)clothing(s,-76+i*35,-8,42);s.bench(49,8,40,38,16);for(let i=0;i<3;i++)s.box(53,12,32,29,20+i*4,3,i===1);});
set('publishing',['펼친 책','인쇄물','제본 도서'],s=>{s.poly([[-85,-30],[-35,-23],[-35,43],[-85,34]],0,5);s.poly([[-35,-23],[16,-32],[16,34],[-35,43]],0,5);for(let i=0;i<8;i++){rod(s,[-78,-21+i*7,5],[-42,-16+i*7,5],.5);rod(s,[-27,-16+i*7,5],[8,-23+i*7,5],.5);}for(let i=0;i<4;i++)book(s,40,-20,i*10,43,57);});
set('financials', ['지갑과 결제 카드', '예금과 자금', '금융 서비스'], s => {
  // A wallet has a continuous body, a visible opening, and a clasp.
  s.box(-83,-10,108,22,0,58,false,'hi',5);
  s.box(-78,-7,98,15,58,2,false,'lo',3); s.material('rubber');
  s.box(-69,-7,72,2,44,47,true,'hi',4);
  s.box(-60,-2,72,2,38,45,false,'hi',4);
  s.box(-53,.5,15,1,68,10,true,'hi',2);
  for(let i=0;i<4;i++)s.box(-53+i*13,.5,8,1,63,2,false,'lo');
  s.box(-84,9,110,5,0,57,true,'hi',5);
  s.box(1,14,31,3,20,18,false,'hi',4);
  s.turned([14,17,29],[0,1,0],[[0,3],[1,3]],true);
  for(let i=0;i<3;i++)coins(s,49+i*16,8+i*20,3+i*2);
  document(s,-68,33,0,70,34);
}, '예금·대출·결제 같은 금융 서비스로 돈의 보관과 이동을 도와요.');
set('banking',['은행 현관','고객 출입구','현금 인출기'],s=>{s.box(-85,-36,112,63,0,7);s.box(-80,-33,102,50,7,53);for(let i=0;i<4;i++)s.round(-69+i*26,23,4,7,53);front(s,-86,-36,60,[[0,0],[115,0],[57,28]],65,true);s.box(-40,18,23,1,7,39,false,'lo');s.box(51,-9,34,35,0,60);s.box(56,26,24,1,34,18,true);s.box(58,27,20,1,17,3,false,'lo');});
set('real-estate',['업무용 빌딩','상가 공간','건물 입구'],s=>{s.building(-78,-37,67,58,106,'office',true);roofShop(s,5,-23,81,53,40);s.box(-15,34,80,9,0,2);plant(s,-85,38,0,.7);});
set('housing',['지붕이 있는 주택','현관','정원'],s=>{house(s,-62,-35,0,94,65,55);for(let i=0;i<4;i++)s.box(-19,34+i*9,20,6,0,1);plant(s,65,8,0,1.4);for(let i=0;i<5;i++)s.box(-85+i*16,48,3,3,0,20);s.box(-85,48,68,3,7,3);});
set('construction',['타워크레인','공사 중인 구조','건축 자재'],s=>{for(const z of [0,30,60]){s.box(-81,-31,82,67,z,4);if(z<60)for(const x of [-76,-9])for(const y of [-26,28])s.box(x,y,5,5,z+4,26);}for(const x of [51,66])rod(s,[x,-20,0],[x,-20,108],2);for(let i=0;i<6;i++)rod(s,[51,-20,i*18],[66,-20,(i+1)*18],1);rod(s,[0,-20,108],[92,-20,108],3,true);rod(s,[4,-20,108],[4,-20,65],1);s.box(0,-24,8,8,60,5);crate(s,36,23,0,49,29,22);});
set('medical-facility',['병원 건물','진료시설 표지','응급 출입구'],s=>{s.building(-74,-30,101,60,84);cross(s,-43,31,52,27);s.box(-52,30,57,21,26,4,true);s.box(-33,31,19,1,0,26,false,'lo');s.box(44,-10,38,51,0,36);cross(s,53,42,8,20);});
set('reit-industrial',['물류센터','하역장','임대 시설'],s=>{s.box(-89,-37,177,69,0,55);s.box(-93,-41,185,77,55,4,true);for(let i=0;i<4;i++){s.box(-78+i*41,32,30,1,4,33,false,'lo');s.box(-81+i*41,33,36,12,2,3);}crate(s,-67,46,0,29,20,19);crate(s,27,43,0,35,25,22);});
set('reit-retail',['쇼핑센터','입점 매장','보행 공간'],s=>{roofShop(s,-94,-40,184,57,53);s.box(-88,-34,172,45,57,25);for(let i=0;i<5;i++){s.box(-80+i*33,11,24,1,63,12);s.material('glass');}for(const x of [-76,65])plant(s,x,44,0,.8);s.bench(-24,43,48,19,12);});
set('shipbuilding',['건조 중인 선박','조선소 크레인','선체 받침'],s=>ship(s,{build:true}));
set('fishing',['어선','어망과 작업 장비','수산물 상자'],s=>ship(s,{fish:true}));
set('shipping',['컨테이너선','적재 컨테이너','운항 선교'],s=>ship(s,{cargo:true}));
set('food',['빵과 과자','식품 포장','가공 식품'],s=>{s.bench(-85,-35,166,70,17);for(let i=0;i<3;i++)loaf(s,-75+i*36,-20,21);for(let i=0;i<3;i++){s.box(-69+i*45,14,30,23,21,3);for(let j=0;j<3;j++)s.round(-63+i*45+j*8,25,3,24,2,true);}s.box(49,-25,26,28,21,35,true);});
set('wood',['통나무 단면','제재 목재','목재 적층'],s=>{for(const [x,z] of [[-65,12],[-39,12],[-52,35]]){s.turned([x,-38,z],[0,1,0],[[0,12],[80,12]],true);for(const r of [4,8])ring(s,[x,42,z],[0,1,0],r,.5);}for(let i=0;i<4;i++){s.box(9,-29,74,59,i*8,6);for(let j=0;j<3;j++)s.box(14,-22+j*16,64,1,i*8+6,.4,false,'lo');}});
set('mining',['광산 입구','광석','광산 수레'],s=>{front(s,-86,-31,0,[[0,0],[5,63],[25,91],[55,78],[77,45],[76,0]],54);front(s,-68,24,0,[[0,0],[0,35],[15,51],[31,35],[31,0]],1,false);s.material('rubber');for(const x of [15,64])wheel(s,x,22,9,9);s.box(3,-12,75,39,14,21);for(let i=0;i<6;i++){const x=14+i%3*25,y=-3+Math.floor(i/3)*18;s.poly([[x-9,y-5],[x,y-9],[x+10,y-2],[x+5,y+7],[x-6,y+6]],35,8+i%3*3,i===2);}});
set('coal',['석탄 더미','광물 운반차','채굴 도구'],s=>{for(let i=0;i<9;i++){const x=-70+i%3*22,y=-22+Math.floor(i/3)*22;s.poly([[x-12,y-7],[x+2,y-11],[x+13,y],[x+6,y+10],[x-9,y+8]],0,9+i%3*4);s.material('rubber');}s.box(17,-21,65,47,13,23);for(const x of [29,69])wheel(s,x,20,9,9);for(let i=0;i<4;i++){const x=30+i%2*29,y=-8+Math.floor(i/2)*22;s.poly([[x-10,y-7],[x+3,y-11],[x+12,y+2],[x+4,y+10],[x-8,y+8]],36,10);s.material('rubber');}rod(s,[-25,50,0],[42,50,35],2);rod(s,[32,50,29],[48,50,51],3);});
set('recycling',['분리수거함','재활용 병','종이와 회수 자원'],s=>{for(let i=0;i<3;i++){const x=-83+i*59;s.box(x,-25,44,47,0,51,i===1);s.box(x-2,-27,48,51,51,4);s.box(x+8,23,28,1,17,17);if(i===0){for(let j=0;j<3;j++)s.bottle(x+12+j*10,-3,55,3,14);}if(i===1){for(let j=0;j<3;j++)s.box(x+5,-20,34,34,55+j*2,1.5);}if(i===2){s.round(x+22,-3,10,55,16);}}});
set('media',['영상 카메라','촬영 조명','제작 공간'],s=>{s.box(-76,-10,53,32,43,31);s.turned([-23,6,59],[1,0,0],[[0,10],[19,13],[25,13]],true);for(const x of [-65,-38])s.turned([x,-10,82],[0,1,0],[[0,13],[6,13]]);for(const x of [-82,-20])rod(s,[-49,6,43],[x,6,0],2);rod(s,[-49,6,43],[-49,39,0],2);rod(s,[57,-6,0],[57,-6,87],2);for(const x of [35,79])rod(s,[57,-6,22],[x,4,0],1.5);front(s,34,-6,64,[[0,0],[46,0],[46,41],[0,41]],6,true);});
set('healthcare', ['진료용 침대', '심박 모니터', '수액 장치'], s => {
  // A raised mattress, pillow, rails and casters distinguish it from a desk.
  for(const x of [-70,15])for(const y of [-23,24]){
    s.box(x,y,4,4,6,17);
    s.turned([x+2,y,5],[0,1,0],[[0,4],[4,4]],false,'lo');s.material('rubber');
  }
  s.box(-78,-28,111,62,23,5,false,'hi',3);
  s.box(-76,-26,107,58,28,10,false,'hi',5);
  s.box(-76,-27,8,60,28,29,true,'hi',3);
  s.box(-66,-19,24,44,38,8,false,'hi',5);
  s.box(-33,-25,63,56,38,3,true,'hi',4);
  for(const y of [-29,34]){
    for(const x of [-31,21])rod(s,[x,y,28],[x,y,49],1.4);
    rod(s,[-35,y,49],[25,y,49],1.6);
  }
  // IV bag hangs from a stand; tube ends beside the bed.
  s.round(58,-29,13,0,3);rod(s,[58,-29,3],[58,-29,111],1.7);
  rod(s,[45,-29,111],[73,-29,111],1.5);
  rod(s,[47,-29,111],[47,-29,100],.8);
  s.box(37,-30,20,6,70,29,false,'hi',4);
  s.box(39,-23.5,16,1,72,14,true,'hi',2);
  rod(s,[47,-27,70],[47,-27,59],1);
  rod(s,[47,-27,59],[28,-27,44],.7);
  // An ECG waveform replaces the generic office-screen grid.
  s.box(52,17,35,27,0,4);rod(s,[69,28,4],[69,28,43],2);
  s.box(45,19,48,6,43,36,false,'hi',3);
  s.box(49,25,40,1,48,26,false,'lo',2);s.material('glass');
  const pulse=[[52,59],[59,59],[63,64],[67,53],[72,70],[76,59],[86,59]];
  for(let i=1;i<pulse.length;i++)rod(s,[pulse[i-1][0],27,pulse[i-1][1]],[pulse[i][0],27,pulse[i][1]],.8);
}, '진료 장비와 의료 서비스를 통해 환자의 상태를 확인하고 치료를 도와요.');
set('surgical-robotics',['관절형 수술 로봇','수술대','조작 화면'],s=>{s.bench(-22,-20,101,47,27);s.box(-18,-16,93,39,31,6);s.box(-67,-29,31,35,0,51);for(let i=0;i<3;i++){const y=-20+i*15;rod(s,[-52,y,51],[-39,y,83],4);s.round(-39,y,5,80,5,true);rod(s,[-39,y,83],[10+i*14,y,74],3);rod(s,[10+i*14,y,74],[16+i*14,y,48],2);rod(s,[16+i*14,y,48],[16+i*14,y,39],.7);}s.monitor(-81,31,0,true,47);});
set('auto-parts',['브레이크 디스크','기어','서스펜션'],s=>{ring(s,[-44,-4,0],[0,0,1],32,9,true);for(let i=0;i<12;i++){const a=i*Math.PI/6;s.round(-44+Math.cos(a)*27,-4+Math.sin(a)*27,1.5,9,1,false,'lo');}s.round(29,-18,24,0,7);for(let i=0;i<12;i++){const a=i*Math.PI/6;s.box(26+Math.cos(a)*24,-21+Math.sin(a)*24,6,6,0,7);}s.round(29,-18,8,7,3,false,'lo');for(let i=0;i<9;i++)ring(s,[49,33,i*5],[0,0,1],10,2,true);rod(s,[49,33,0],[49,33,52],3);});
set('appliances',['드럼 세탁기','냉장고','가정용 전기기기'],s=>{s.box(-83,-25,67,59,0,65);ring(s,[-49,35,30],[0,1,0],21,4,true);s.turned([-49,35,30],[0,1,0],[[0,15],[1,15]]);s.material('glass');s.box(-77,34,25,1,55,5);s.round(-27,31,3,60,2);s.box(19,-31,62,63,0,103);s.box(20,32,60,1,62,1,false,'lo');s.box(26,33,3,3,69,24);s.box(26,33,3,3,29,22);});
set('energy',['시추탑','시추 장비','원유 생산'],s=>{for(const x of [-65,-9])for(const y of [-28,28])rod(s,[x,y,0],[-37+(x===-65?-9:9),y*.3,109],3);for(let z=18;z<100;z+=20){const w=56-z*.34;s.box(-37-w/2,-28+z*.18,w,56-z*.36,z,3);}rod(s,[-37,0,0],[-37,0,120],2,true);s.round(49,0,24,0,49);s.round(49,0,25,49,3);s.box(28,-15,42,30,52,4,true);});
set('truck',['화물 트럭','적재함','타이어'],s=>{s.box(-88,-26,114,53,22,58);for(let i=0;i<12;i++)s.box(-83+i*9,27,1,1,28,46);s.box(26,-24,57,49,21,38,true,'hi',5);s.box(46,25,29,1,42,14);s.material('glass');s.box(82,-17,1,35,41,15);s.material('glass');s.box(-88,-26,171,53,17,5,false,'lo');for(const x of [-63,-29,62])for(const y of [-29,23])wheel(s,x,y,12,12);});
set('rail',['열차','철도 차륜','선로'],s=>{for(let i=0;i<14;i++)s.box(-97+i*15,-36,5,73,0,2);for(const y of [-27,27])s.box(-103,y,206,3,2,3);s.box(-86,-23,171,46,15,46,true,'hi',8);for(let i=0;i<10;i++){s.box(-77+i*15,23,10,1,35,16);s.material('glass');}for(const x of [-65,-47,43,61])for(const y of [-28,22])wheel(s,x,y,9,8);s.box(85,-18,1,36,33,18,false,'lo');s.box(-81,-17,157,34,61,3);});

// Second editorial pass: one legible hero object per industry.
set('brokerage',['주식 주문 단말기','가격 차트','매수·매도 주문'],s=>{
 s.box(-68,-19,103,18,5,112,false,'hi',8);
 s.box(-61,0,89,1,16,93,false,'hi',4);
 s.box(-53,2,31,1,99,3,true);
 const bars=[[0,65,84],[13,61,74],[26,70,91],[39,76,85],[52,80,96]];
 for(const [x,lo,hi] of bars){rod(s,[-49+x,3,lo-4],[-49+x,3,hi+4],.7);s.box(-52+x,3,6,1,lo,hi-lo,x%26===0);}
 for(let i=0;i<3;i++){s.box(-52,2,26-i*4,1,48+i*5,2,true);s.box(-12,2,29-i*5,1,48+i*5,2);}
 s.box(-53,2,30,1,24,12,true,'hi',3);s.box(-15,2,30,1,24,12,false,'hi',3);
 rod(s,[-43,4,30],[-33,4,30],1);rod(s,[0,4,26],[0,4,34],1);rod(s,[-4,4,30],[4,4,30],1);
 s.box(-41,-11,51,27,0,5,false,'hi',4);
 // A single large exchange arrow, rather than scattered coins.
 s.poly([[49,12],[72,12],[72,7],[85,17],[72,27],[72,22],[49,22]],2,3,true);
 s.poly([[85,37],[62,37],[62,32],[49,42],[62,52],[62,47],[85,47]],2,3);
},'주식을 사고팔려는 주문을 시장에 연결하는 서비스를 제공해요.');
set('software',['노트북','코드 편집 화면','프로그램 창'],s=>{
 s.box(-87,-30,159,7,8,91,false,'hi',5);
 s.box(-81,-22,147,1,17,74,false,'hi',3);
 s.box(-81,-20,147,1,80,11,true);
 for(let i=0;i<3;i++)s.turned([-73+i*7,-18,85],[0,1,0],[[0,1.5],[1,1.5]],i===0);
 s.box(-80,-19,27,1,18,61,false,'lo');
 for(let i=0;i<5;i++)s.box(-75,-17,13+(i%2)*5,1,68-i*9,2);
 for(const [x,z,w] of [[-39,68,37],[-30,57,62],[-30,46,45],[-39,35,28]])s.box(x,-18,w,1,z,2,true);
 // Brackets make this a code editor, not another spreadsheet.
 for(const [a,b] of [[[42,-17,65],[34,-17,57]],[[34,-17,57],[42,-17,49]],[[52,-17,65],[60,-17,57]],[[60,-17,57],[52,-17,49]]])rod(s,a,b,1.2);
 s.box(-90,-25,165,88,3,5,false,'hi',5);
 s.box(-78,-13,141,40,8,1,false,'lo',3);
 for(let row=0;row<4;row++)for(let col=0;col<12;col++)s.box(-74+col*11.3,-9+row*8.5,9,6,9,.5);
 s.box(-27,35,40,20,8,.5,false,'hi',3);
},'컴퓨터와 모바일에서 일을 처리하는 프로그램을 만들고 제공해요.');
set('asset-management',['자산 배분 도표','운용 보고서','투자 자금'],s=>{
 // Actual curved pie sectors with distinct shares, on a bound report.
 s.box(-87,-43,108,104,0,5,true,'hi',4);s.box(-82,-39,98,96,5,1,false,'hi',2);
 const cx=-33,cy=-2,r=31;
 for(const [a,b,h,lit] of [[0,Math.PI,10,true],[Math.PI,Math.PI*1.6,7,false],[Math.PI*1.6,Math.PI*2,5,false]]){
 const pts=[[cx,cy]];for(let i=0;i<=24;i++){const t=a+.025+(b-a-.05)*i/24;pts.push([cx+r*Math.cos(t),cy+r*Math.sin(t)]);}s.poly(pts,6,h,lit);
 }
 for(let i=0;i<3;i++){s.box(-70+i*27,40,6,5,6,.7,i===0);s.box(-61+i*27,41,13,2,6,.7);}
 s.box(-69,-32,63,3,6,1,true);
 for(let i=0;i<3;i++)coins(s,48+i*15,12+i*19,3+i*2);
},'투자자의 자금을 여러 자산에 나누어 운용하고 관리해요.');
set('hotel',['호텔 건물','객실 창문','현관과 여행 가방'],s=>{
 s.box(-76,-37,117,62,0,104,false,'hi',3);s.box(-81,-42,127,72,104,5,true,'hi',3);
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){
 const x=-66+col*27,z=42+row*19;s.box(x,25,16,1,z,13,true,'hi',1);rod(s,[x+8,27,z],[x+8,27,z+13],.6);
 }
 s.box(-39,25,42,1,0,28,false,'lo');s.material('glass');rod(s,[-18,27,0],[-18,27,28],.8);
 s.box(-51,24,66,29,28,5,true);for(const x of [-47,9])rod(s,[x,49,0],[x,49,28],1.5);
 s.box(-55,29,74,27,0,3);s.box(-60,34,84,27,0,1.5);
 // A hotel sign using an H silhouette, not unreadable tiny lettering.
 s.box(41,-8,7,30,68,28,true);for(const y of [-2,12])s.box(48,y,1,4,74,16);s.box(48,2,1,10,80,4);
 s.box(64,25,24,19,3,31,true,'hi',4);for(const x of [68,81])s.round(x,42,2,0,3);rod(s,[70,31,34],[70,31,44],1);rod(s,[82,31,34],[82,31,44],1);rod(s,[70,31,44],[82,31,44],1);
},'객실과 숙박 서비스를 제공하고 객실 이용료 등을 받아요.');
set('agriculture',['트랙터','경작지','곡물 작물'],s=>{
 // Crops grow directly from soil, with tapered leaves and grain heads.
 for(let j=0;j<3;j++){
 const y=-37+j*18;s.box(-91,y,85,12,0,3,false,'lo',4);
 for(let i=0;i<4;i++){const x=-81+i*20;rod(s,[x,y+6,3],[x,y+6,40],.65);for(let n=0;n<4;n++)for(const side of [-1,1])s.turned([x,y+6,26+n*3],[side*.65,0,.76],[[0,.5],[2,1.5],[5,.4],[6,0]],true);rod(s,[x,y+6,13],[x-6,y+6,22],.7,true);rod(s,[x,y+6,18],[x+5,y+6,25],.7,true);}
 }
 // Tractor: large rear wheel, small front wheel, open cab and exhaust.
 s.box(10,8,78,30,14,8,true,'hi',3);s.box(50,10,35,26,22,22,true,'hi',4);
 for(const y of [3,34]){wheel(s,25,y,17,17);wheel(s,74,y,10,10);}
 for(const x of [13,43])for(const y of [11,32])rod(s,[x,y,23],[x,y,62],1.3);
 s.box(9,6,39,32,62,4,true,'hi',3);s.box(20,16,15,15,25,5);s.box(18,15,4,17,30,15);
 rod(s,[62,17,44],[62,17,63],2);for(let i=0;i<4;i++)s.box(85,14+i*5,1,2,28,10,false,'lo');
},'땅을 경작하고 곡물과 농산물을 재배·생산해요.');
set('musical-instruments',['업라이트 피아노','건반','연주 의자'],s=>{
 s.box(-87,-30,161,30,12,81,true,'hi',3);s.box(-91,-33,169,36,93,4);
 s.box(-81,1,149,4,57,29,false,'hi',2);s.box(-86,0,159,30,46,8);
 // White keys have the familiar 2–3 grouping of raised black keys.
 for(let i=0;i<28;i++)s.box(-80+i*5.2,5,4.9,23,54,2);
 for(let i=0;i<27;i++)if(![2,6].includes(i%7)){s.box(-77+i*5.2,5,3,13,56,3);s.material('rubber');}
 for(const x of [-86,65])s.box(x,2,8,26,0,46,true);
 for(const x of [-20,-10,0])s.box(x,12,5,16,4,2);
 s.box(-45,44,72,25,23,5,true,'hi',4);for(const x of [-40,18])for(const y of [47,62])s.box(x,y,4,4,0,23);
},'피아노처럼 연주자가 소리를 내어 음악을 만드는 악기를 생산해요.');
set('lighting',['관절형 스탠드','전등갓과 광원','LED 전구'],s=>{
 s.round(-42,9,31,0,5,true);s.round(-42,9,22,5,2);
 const joints=[[-42,9,7],[-68,9,49],[-18,9,83]];
 for(let i=1;i<joints.length;i++)for(const y of [5,13])rod(s,[joints[i-1][0],y,joints[i-1][2]],[joints[i][0],y,joints[i][2]],2);
 for(const [x,y,z] of joints)s.turned([x,y-6,z],[0,1,0],[[0,4],[12,4]],true);
 rod(s,[-18,9,83],[-8,9,83],2);
 s.turned([-3,9,82],[0,0,-1],[[0,8],[7,9],[26,22]],true);
 s.round(-3,9,19,55,1);s.round(-3,9,7,52,3,true);
 // A light bulb with globe, neck and screw base, not a row of discs.
 s.turned([64,12,0],[0,0,1],[[0,9],[18,9],[23,12],[28,18],[38,22],[49,20],[57,13],[60,0]]);
 for(let z=3;z<18;z+=4)ring(s,[64,12,z],[0,0,1],10,1,true);
},'전구와 조명 기구를 만들어 생활 공간과 작업 공간을 밝혀요.');
set('automotive',['승용차','차창과 헤드라이트','타이어'],s=>{
 const F={o:[-90,-27,0],a:[0,1,0],u:[1,0,0],v:[0,0,1]};
 // Concave lower contour leaves actual wheel arches instead of buried tires.
 const outline=[[0,18],[3,29],[29,34],[52,57],[103,57],[132,35],[172,29],[178,20],[176,14],[157,14],[155,23],[149,30],[139,32],[129,29],[124,22],[123,14],[48,14],[46,23],[40,30],[30,32],[20,28],[16,20],[15,14],[1,14]];
 s.prism(F,outline,0,54,true);
 for(const y of [-31,24]){wheel(s,-58,y,16,15);wheel(s,50,y,16,15);}
 for(const y of [-27.8,54-27]){
 front(s,-90,y,0,[[36,35],[55,53],[77,53],[77,35]],.5);s.material('glass');
 front(s,-90,y,0,[[82,35],[82,53],[101,53],[124,35]],.5);s.material('glass');
 for(const x of [-26,18])s.box(x,y+1,9,1,31,2);
 rod(s,[-10,y+1,16],[-10,y+1,35],.5);
 }
 const L=Math.hypot(29,22);s.prism({o:[13,-27,57],a:[22/L,0,29/L],u:[0,1,0],v:[29/L,0,-22/L]},[[4,3],[50,3],[50,L-3],[4,L-3]],0,.5);s.material('glass');
 s.box(-35,-24,43,48,57,1,true,'hi',3);
 for(const y of [-23,15]){s.box(85,y,2,9,23,5);s.box(-89,y,2,9,23,5,true);}
 s.box(87,-10,1,20,17,5,false,'lo');s.material('rubber');
 for(const y of [-33,28])s.box(27,y,8,5,35,4,true,'hi',2);
},'차체와 구동 장치 등을 조립해 사람이 타고 이동하는 자동차를 만들어요.');

// Refine adjacent technical fields through recognizable functional connections.
const enhancements = {
 technology:s=>{s.box(-90,36,65,18,0,2);for(let i=0;i<8;i++)s.box(-86+i*7,39,5,10,2,.5);},
 communication:s=>{ring(s,[-49,-8,94],[0,0,1],12,1,true);},
 industrials:s=>{rod(s,[-16,-25,65],[10,-6,80],4,true);rod(s,[10,-6,80],[27,2,45],3);},
 materials:s=>{for(const z of [27,40])s.turned([-29,-18,z],[0,1,0],[[0,7],[39,7]],true);},
 utilities:s=>{rod(s,[-48,0,59],[-48,42,59],1.5,true);rod(s,[-48,42,59],[49,42,59],1.5,true);rod(s,[49,42,59],[49,0,44],1.5,true);},
 photonics:s=>{for(let i=0;i<3;i++)rod(s,[-52+i*17,5,28],[40,28,20+i*6],1,true);},
 pharma:s=>{for(let i=0;i<3;i++){s.box(-70+i*26,32,21,15,0,3,true,'hi',7);s.box(-60+i*26,32,11,15,3,.5);}},
 'fuel-cells':s=>{rod(s,[-70,-33,29],[-70,-49,29],3,true);rod(s,[-15,-33,36],[-15,-49,36],3);},
 quantum:s=>{for(let i=0;i<3;i++)rod(s,[-63,-18+i*18,36],[0,0,30],.6,true);},
 'data-center-power':s=>{ring(s,[67,24,52],[0,1,0],15,2,true);for(let i=0;i<4;i++){const a=i*Math.PI/2;rod(s,[67,27,52],[67+Math.cos(a)*11,27,52+Math.sin(a)*11],2);}},
 cybersecurity:s=>{shield(s,-16,38,0);},
 'cloud-data':s=>{for(let i=0;i<3;i++)rod(s,[-35,23,16+i*11],[6,23,16+i*11],1.2,true);},
 'advanced-nuclear':s=>{document(s,18,39,0,64,29);},
 'nuclear-generation':s=>{s.turned([-47,-4,0],[0,0,1],[[0,34],[15,28],[47,20],[72,25],[76,26]],false);},
 biomanufacturing:s=>{rod(s,[-48,-6,86],[-48,-6,101],2);rod(s,[-48,-6,101],[29,-6,101],2,true);rod(s,[29,-6,101],[29,-6,57],2,true);},
 'digital-assets':s=>{ring(s,[-16,38,24],[0,1,0],17,4,true);ring(s,[9,38,24],[0,1,0],17,4,true);},
 'post-quantum-security':s=>{for(let i=0;i<3;i++)rod(s,[-5,35,11+i*9],[40,35,11+i*9],1,true);},
 electronics:s=>{s.box(39,32,33,52,0,4);s.box(42,36,27,41,4,.5);s.material('glass');},
 'oil-tanks':s=>{rod(s,[-57,-10,70],[-57,-39,70],2);rod(s,[-57,-39,70],[15,-39,70],2);rod(s,[15,-39,70],[15,-10,54],2);},
 'gas-supply':s=>{rod(s,[-52,-10,72],[-52,40,72],3,true);rod(s,[-52,40,72],[45,40,72],3,true);rod(s,[45,40,72],[45,22,40],3);},
 water:s=>{for(const x of [-52,24]){s.round(x,-8,24,42,.5,true);rod(s,[x,-32,42],[x,16,42],1.5);}},
 lab:s=>{s.round(-61,37,12,0,3);rod(s,[-61,37,3],[-61,37,46],3);rod(s,[-61,37,46],[-39,37,46],3);s.turned([-39,37,46],[0,0,-1],[[0,5],[17,5]],true);},
 beverages:s=>{for(let i=0;i<4;i++){s.box(-70+i*42,-27,3,20,49,3);rod(s,[-69+i*42,-26,26],[-69+i*42,-26,52],2);}},
 chemicals:s=>{rod(s,[-50,-10,75],[-50,-37,75],2);rod(s,[-50,-37,75],[23,-37,75],2,true);rod(s,[23,-37,75],[23,-8,59],2);},
 machinery:s=>{s.round(0,10,19,23,5,true);s.box(-20,6,40,8,28,3);},
 paper:s=>{s.turned([-72,-33,20],[1,0,0],[[0,16],[44,16]]);ring(s,[-27,-33,20],[1,0,0],6,2);},
 optics:s=>{rod(s,[-70,0,49],[70,0,49],.6,true);},
 cables:s=>{ring(s,[4,43,22],[0,1,0],23,4,true);},
 lighting:s=>{rod(s,[-65,0,14],[-65,0,47],2);s.turned([-65,0,47],[0,0,1],[[0,18],[21,10]],true);},
};
// Preserve the aircraft object while separating manufacture from operation.
export function reviseScenes(entries){
 for(const entry of entries){
  const original=entry.draw;
  if(revisions[entry.id])Object.assign(entry,revisions[entry.id]);
  else if(enhancements[entry.id])entry.draw=s=>{original(s);enhancements[entry.id](s);};
  if(entry.id==='aerospace'){
   entry.parts=['조립 중인 항공기','정비 작업대','항공 부품'];
   entry.draw=s=>{original(s);s.bench(22,37,49,28,18);s.round(46,51,10,22,5,true);for(const x of [-84,71]){s.box(x,-32,4,24,0,42);for(let z=8;z<40;z+=8)s.box(x,-32,14,3,z,2);}};
  }
  if(entry.id==='airline'){
   entry.parts=['여객기','탑승 계단','수하물 운반'];
   entry.draw=s=>{original(s);for(let i=0;i<6;i++)s.box(43+i*5,22,5,23,0,29-i*4);s.box(-79,35,54,26,5,4);for(let i=0;i<3;i++)crate(s,-76+i*16,38,9,13,19,13);};
  }
 }
}
