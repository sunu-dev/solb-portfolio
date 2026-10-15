// Concepts and assemblies are authored before geometry. Captions describe a representative
// activity, never every company or an actual customer's installation.
const entries = [];
const add = (id, title, caption, parts, draw, note = '산업을 이해하기 위한 대표 장면이에요. 회사마다 제품과 설비는 달라요.') => entries.push({ id, title, caption, parts, draw, note });

add('semiconductors', '반도체', '웨이퍼에서 만든 작은 칩이 전자제품의 계산과 저장을 맡아요.', ['웨이퍼', '회로 칩', '전자 기판'], s => {
  s.bench(-92, -42, 184, 84, 12); s.wafer(-43, -3, 16, 35); s.board(17, -27, 16, 62, 51, true);
});
add('technology', '정보기술', '컴퓨터와 서버에서 소프트웨어가 작동하고 데이터를 처리해요.', ['사용자 컴퓨터', '서버', '처리 장치'], s => { s.monitor(-90, -12, 0, true, 65); s.cabinet(18, -30, 55, 47, 83, 6); s.board(-83, 20, 0, 55, 32); });
add('communication', '통신·미디어', '통신 장비가 휴대전화와 콘텐츠 서비스를 연결해요.', ['안테나', '통신 장비', '휴대전화'], s => {
  s.box(-63, -28, 25, 25, 0, 6); s.box(-55, -20, 9, 9, 6, 83);
  s.box(-67, -11, 39, 4, 57, 3);
  for (let i = 0; i < 3; i++) { s.box(-64 + i * 11, -11, 7, 7, 60, 34, i === 1, 'hi'); s.box(-62 + i * 11, -4, 3, .6, 64, 26, false, 'lo'); }
  s.cabinet(-90, 10, 28, 30, 40, 3); s.box(20, -21, 42, 62, 0, 5, false, 'hi', 5); s.box(23, -17, 36, 50, 5, .7, true, 'lo', 3);
  for (let i = 0; i < 12; i++) s.box(27 + i % 3 * 10, -12 + Math.floor(i / 3) * 11, 7, 7, 5.7, .3, false, 'mid');
});
add('consumer-discretionary', '경기소비재', '소비자가 매장에서 생활용품과 여가용품을 골라 구매해요.', ['진열 선반', '소비재', '매장'], s => s.shelves('boxes'));
add('consumer-staples', '필수소비재', '식품과 생활용품을 만들어 매장에 공급해요.', ['식품', '생활용품', '매장 진열'], s => s.shelves('bottles'));
add('energy', '에너지', '유전의 시추·생산 장비로 원유를 얻어요.', ['시추탑', '작업대', '생산 설비'], s => {
  s.box(-51, -32, 78, 64, 0, 6); s.screws(-51, -32, 78, 64, 6);
  for (const x of [-40, 10]) for (const y of [-22, 20]) for (const [z, h] of [[6, 9], [18, 16], [37, 16], [56, 16], [75, 15]]) s.box(x, y, 6, 6, z, h);
  for (const z of [15, 34, 53, 72, 90]) s.box(-40, -22, 56, 48, z, 3);
  s.box(-25, -4, 7, 7, 93, 12, true, 'hi'); s.cabinet(48, -17, 35, 37, 49, 4);
  s.box(-48, 32, 3, 3, 0, 93); s.box(-39, 32, 3, 3, 0, 93);
  for (let i = 0; i < 10; i++) s.box(-45, 32, 6, 3, 8 + i * 8, 2, false, 'lo');
});
add('financials', '금융', '은행은 예금과 대출 등 금융 서비스를 제공해요.', ['은행 건물', '업무 창구', '금융 서비스'], s => s.building(-65, -39, 130, 77, 56, 'office', true));
add('healthcare', '헬스케어', '진료 현장에서 의료진이 장비로 환자의 상태를 확인해요.', ['진료 장비', '관찰 화면', '의료 소모품'], s => { s.desk('lab'); s.box(-67, 12, 57, 19, 35, 6, true); for (let i = 0; i < 7; i++) s.box(-63 + i * 7, 16, 4, 10, 41, 2); });
add('industrials', '산업재', '공장의 생산 장비가 부품을 가공하고 조립해요.', ['운반 장치', '가공 장비', '완성 부품'], s => {
  s.conveyor(); s.box(-26, -42, 48, 17, 0, 68); s.box(-26, -25, 48, 10, 56, 12); s.box(-12, -15, 14, 13, 56, 9, true); s.screws(-26, -42, 48, 17, 68);
  for (const x of [-60, 30, 58]) s.box(x, -10, 18, 18, 26.7, 9, false, 'hi');
});
add('materials', '소재', '금속을 가공해 다른 산업이 쓸 재료를 만들어요.', ['금속 원료', '압연 설비', '가공 소재'], s => {
  s.conveyor(-86, -21, 172, 19); s.box(-17, -18, 35, 28, 24.7, 5, true);
  for (const x of [-43, 22]) for (const y of [-34, 22]) { s.box(x, y, 13, 9, 0, 46); s.screws(x, y, 13, 9, 46); }
  s.box(-43, -34, 78, 65, 46.6, 8); s.box(-64, -14, 22, 22, 24.7, 5);
});
add('real-estate', '부동산', '건물을 개발하거나 임대하고 관리해요.', ['업무용 건물', '입주 공간', '건물 설비'], s => s.building(-61, -35, 122, 70, 84, 'office', true));
add('utilities', '전력·유틸리티', '전력망의 설비가 전기를 가정과 사업장에 전달해요.', ['변전 설비', '전력 제어', '고객 건물'], s => { s.building(24, -33, 66, 62, 44, 'home'); transformer(s, -79, -27); });
add('photonics', '광소재·광통신', '송수신 모듈이 빛을 이용해 데이터를 주고받아요.', ['광 송수신 장치', '광학 모듈', '서버'], s => {
  s.cabinet(36, -31, 44, 49, 82, 6); s.bench(-93, -34, 104, 76, 15); s.board(-85, -24, 19, 86, 54, false, false);
  for (let i = 0; i < 4; i++) { s.box(-71 + i * 17, -5, 12, 18, 21, 7, i === 2); s.round(-65 + i * 17, 1, 4, 28, 3, i === 2, 'hi'); }
});
add('pharma', '의약·바이오', '연구와 시험을 거쳐 질병 치료에 쓸 의약품을 개발해요.', ['연구 장비', '시험 용기', '의약품'], s => { s.desk('lab'); for (let i = 0; i < 4; i++) s.bottle(10 + i * 13, 26, 35, 4, 8, i === 2); });
add('equipment', '반도체 소부장', '정밀 장비와 소재로 웨이퍼에 반도체 회로를 만들어요.', ['정밀 작업대', '웨이퍼', '공정 장비'], s => {
  s.bench(-88, -43, 176, 86, 16); s.wafer(4, 3, 20, 30, true);
  for (const x of [-71, 59]) s.box(x, -34, 12, 67, 20, 54);
  s.box(-71, -34, 142, 16, 74, 8); s.screws(-71, -34, 142, 16, 82);
  s.box(-17, -18, 37, 21, 63, 11); s.box(-11, -5, 25, 8, 54, 9); s.round(2, -1, 4, 49, 5, false, 'hi');
});
add('defense', '방산', '레이더 같은 탐지·방어 시스템을 공급해요.', ['접시형 레이더', '안테나 받침', '제어 장치'], s => radar(s));
add('aerospace', '항공·우주', '항공기와 그 부품을 제작해 공급해요.', ['둥근 동체', '날개와 엔진', '꼬리날개'], s => aircraft(s));
add('shipbuilding', '조선', '조선소에서 선체와 구조물을 조립해 배를 만들어요.', ['선체', '상부 구조', '건조 받침대'], s => ship(s));
add('batteries', '배터리', '여러 전지를 묶은 배터리 팩에 전기를 저장해요.', ['전지 셀', '배터리 팩', '전력 제어'], s => {
  s.box(-83, -39, 166, 78, 0, 4); s.screws(-83, -39, 166, 78, 4);
  for (let a = 0; a < 9; a++) for (let b = 0; b < 4; b++) { s.round(-70 + a * 16, -25 + b * 16, 6.5, 4, 27, a === 4 && b === 1, 'hi'); s.round(-70 + a * 16, -25 + b * 16, 2, 31, .8, false, 'lo'); }
});
add('automotive', '자동차', '완성차와 핵심 부품을 만들어 이동 수단을 공급해요.', ['차체', '원형 타이어', '차창'], s => { s.vehicle(-78, -28); });
add('fuel-cells', '연료전지·분산발전', '연료전지의 여러 층에서 연료와 산소의 반응으로 전기를 만들어요.', ['연료전지 적층', '발전 장비', '제어 장치'], s => {
  s.box(-88, -35, 90, 70, 0, 7); for (let i = 0; i < 17; i++) s.box(-75, -31, 64, 62, 7 + i * 3, 3, i === 8, 'hi');
  for (const x of [-83, -5]) for (const y of [-26, 26]) s.box(x, y, 3, 3, 7, 51, false, 'lo');
  s.box(-88, -35, 90, 70, 58, 5); s.screws(-88, -35, 90, 70, 63); s.cabinet(33, -28, 47, 52, 76, 5);
});
add('quantum', '양자컴퓨팅', '정밀 제어 장치로 양자 상태를 다루고 계산 결과를 읽어요.', ['제어 장치', '양자 소자', '측정 장치'], s => {
  s.bench(-94, -44, 188, 88, 17); s.board(-37, -24, 21, 74, 51, true);
  for (const x of [-72, 58]) { s.box(x, -30, 16, 60, 21, 8); for (const y of [-18, 0, 18]) { s.box(x + 3, y, 10, 5, 29, 15); s.round(x + 8, y + 2.5, 2, 44, 3); } }
  s.box(-21, -9, 42, 20, 27, 3, true); for (let i = 0; i < 7; i++) s.box(-17 + i * 5, -7, 2, 16, 30, .8, false, 'hi');
}, '이온트랩을 떠올릴 수 있는 광학 실험대의 개념도예요. 양자컴퓨터의 구현 방식은 기업마다 달라요.');
add('servers', '서버', '서버 안의 처리 장치와 메모리가 데이터를 계산하고 저장해요.', ['서버 섀시', '처리 장치', '저장 장치'], s => { s.cabinet(-73, -30, 60, 60, 91, 7); s.board(13, -30, 0, 75, 60, true); });
add('nand-storage', 'NAND·SSD', '전원이 꺼져도 데이터를 보관하는 메모리 칩을 SSD에 넣어요.', ['저장 기판', '메모리 칩', '접속 단자'], s => { s.board(-83, -36, 0, 166, 72, false, false); for (let a = 0; a < 4; a++) for (let b = 0; b < 2; b++) s.box(-67 + a * 37, -22 + b * 30, 24, 18, 2, 4, a === 2 && b === 1, 'hi'); });
add('hdd-storage', 'HDD', '자기 디스크와 읽기 장치로 데이터를 기록하고 읽어요.', ['자기 디스크', '읽기 장치', '드라이브 본체'], s => {
  s.box(-80, -45, 160, 90, 0, 8, false, 'hi', 8); s.screws(-80, -45, 160, 90, 8);
  s.round(-18, -4, 34, 8, 3, true, 'hi'); s.round(-18, -4, 7, 11, 2, false, 'lo'); s.round(-18, -4, 4, 13, 2, false, 'hi');
  s.round(54, 21, 9, 8, 14); s.poly([[45, 21], [-13, 4], [-19, -3], [50, 13]], 22, 2, true);
  for (let i = 0; i < 8; i++) s.box(-66 + i * 15, 36, 10, 5, 8, 1, false, 'lo');
  for (let i = 0; i < 7; i++) s.box(34, -33 + i * 5, 34, 2, 8, .6, false, 'lo');
});
add('networking', '네트워크', '스위치의 여러 접속구가 서버와 장비를 서로 연결해요.', ['네트워크 스위치', '접속구', '처리 기판'], s => { s.cabinet(-86, -32, 88, 58, 42, 3); s.board(18, -30, 0, 64, 57, true); for (let i = 0; i < 12; i++) s.box(-79 + i % 6 * 13, 26.8, 9, .4, 10 + Math.floor(i / 6) * 17, 7, i === 8, 'lo'); });
add('data-center-power', '데이터센터 전력·냉각', '서버의 전력을 공급하고 냉각 장비로 열을 관리해요.', ['전력 설비', '서버', '냉각 장비'], s => { s.cabinet(-93, -25, 43, 48, 78, 5); s.cabinet(-24, -25, 43, 48, 88, 6); s.cabinet(45, -25, 43, 48, 78, 4, true); });
add('cybersecurity', '사이버보안', '기기와 데이터를 확인해 허용된 접근을 보호해요.', ['보안 장치', '접근 확인', '보호할 데이터'], s => { s.cabinet(25, -32, 54, 60, 80, 6); safe(s, -81, -28, false); }, '잠금장치와 서버로 접근 보호를 비유한 그림이에요. 실제 보안 소프트웨어의 내부 구조는 아니에요.');
add('cloud-data', '기업 데이터·AI 플랫폼', '서버의 데이터를 연결해 분석과 실제 업무에 활용해요.', ['데이터 서버', '분석 화면', '업무 활용'], s => { s.cabinet(-82, -32, 47, 54, 80, 6); s.monitor(0, -19, 0, true, 78); s.board(0, 16, 0, 70, 26); });
add('space-launch', '우주 발사', '발사체가 위성 같은 탑재체를 우주로 운반해요.', ['발사체', '발사 지지대', '탑재 공간'], s => rocket(s));
add('satellite-communications', '위성 통신', '통신 위성의 안테나와 장비가 지상과 신호를 주고받아요.', ['위성 본체', '태양전지판', '통신 장비'], s => satellite(s));
add('advanced-nuclear', '소형·차세대 원자로', '원자로 설계를 검토하고 실증과 허가를 거쳐 개발해요.', ['원자로 모형', '설계 검토', '실증 준비'], s => { reactor(s, -48, -6); s.monitor(17, -16, 0, false, 62); s.board(15, 16, 0, 67, 23); }, '개발 단계를 설명하는 원자로 모형이에요. 상용 가동이나 개별 설계의 안전성·허가를 뜻하지 않아요.');
add('nuclear-fuel', '핵연료', '원자로에서 사용할 연료를 가공해 연료봉과 집합체를 만들어요.', ['연료봉', '연료 집합체', '고정 구조'], s => {
  s.box(-55, -37, 110, 74, 0, 6); s.screws(-55, -37, 110, 74, 6);
  for (let a = 0; a < 7; a++) for (let b = 0; b < 4; b++) { s.round(-42 + a * 14, -23 + b * 15, 3.8, 6, 79, a === 3 && b === 3, 'hi'); s.round(-42 + a * 14, -23 + b * 15, 2.1, 85, 2, false, 'lo'); }
});
add('nuclear-generation', '원자력 발전', '발전소가 원자로의 열을 이용해 전기를 생산해요.', ['발전소', '원자로 건물', '전력 설비'], s => { s.building(14, -33, 78, 58, 37, 'office'); s.tank(-47, -4, 32, 65, true); }, '원자력 발전소의 대표 시설을 단순화했어요. 원자로 개발이나 핵연료 판매와 다른 발전 운영 사업이에요.');
add('surgical-robotics', '수술 로봇', '의료진이 조작하는 장비가 수술 도구의 정밀한 움직임을 도와요.', ['의료진 조작부', '수술 장비', '정밀 도구'], s => {
  s.monitor(-95, -19, 0, false, 51); s.bench(-14, -27, 102, 58, 26); s.box(25, -39, 18, 10, 0, 72); s.box(25, -29, 18, 18, 63, 9); s.box(3, -11, 40, 9, 63, 8); s.box(3, -2, 9, 19, 55, 8, true); s.box(5, 8, 4, 4, 41, 14, true); for (let i = 0; i < 9; i++) s.box(-7 + i * 9, -20, 6, 37, 30, 2, false, 'lo');
});
add('biomanufacturing', '바이오 위탁생산', '개발사의 의뢰를 받아 배양 설비로 바이오의약품을 생산해요.', ['배양 설비', '공정 제어', '제품 용기'], s => { s.tank(-48, -6, 25, 77, true); s.cabinet(14, -31, 42, 36, 57, 4); for (let i = 0; i < 5; i++) s.bottle(16 + i * 14, 28, 0, 4, 20); });
add('payments', '결제망', '결제 단말기에서 보낸 정보를 결제망이 연결하고 처리해요.', ['결제 단말기', '접속 장치', '결제 처리'], s => { s.box(-85, -34, 69, 70, 0, 10, false, 'hi', 5); s.box(-79, -26, 57, 26, 10, 2, true, 'lo', 2); for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) s.box(-75 + a * 17, 5 + b * 6, 11, 4, 10, 1, false, 'mid'); s.cabinet(24, -28, 51, 52, 75, 5); });
add('brokerage', '증권 중개', '투자자의 주문을 금융상품 거래로 연결해요.', ['주문 화면', '업무 단말기', '거래 정보'], s => s.desk());
add('digital-assets', '가상자산 플랫폼', '가상자산을 거래하고 보관하는 서비스를 운영해요.', ['거래 단말기', '보관 장치', '접근 보호'], s => { s.monitor(-92, -12, 0, true, 65); safe(s, 11, -27, true); }, '거래 화면과 금고로 거래·보관 서비스를 비유했어요. 가상자산이 금고 안에 실물로 보관된다는 뜻은 아니에요.');
add('solar-equipment', '태양광 장비', '태양전지판을 만들어 발전 설비에 공급해요.', ['태양전지 셀', '패널 프레임', '설치 지지대'], s => s.solar());
add('post-quantum-security', '양자내성 암호·보안', '양자컴퓨터의 공격에도 대비하는 암호로 정보를 보호해요.', ['정보 보관', '잠금 구조', '접근 보호'], s => { safe(s, -62, -34, true); s.board(18, -30, 0, 70, 57); }, '잠금 구조로 암호의 역할을 비유했어요. 실제 암호 알고리즘이나 양자컴퓨터 장치의 구조는 아니에요.');
add('industrial-gases', '산업용 가스', '산업 현장에 필요한 가스를 생산·저장해 공급해요.', ['저장 탱크', '운반 용기', '공급 관리'], s => { s.tank(-54, -11, 27, 79, true); for (let i = 0; i < 4; i++) { s.bottle(9 + i * 22, 7, 0, 7, 46); s.round(9 + i * 22, 7, 2, 49, 4); } });

function transformer(s, x, y) {
  s.box(x, y, 58, 52, 0, 6); s.box(x + 6, y + 6, 46, 40, 6, 43, true);
  for (let i = 0; i < 10; i++) s.box(x + 8 + i * 4, y + 46, 2, 5, 10, 31, false, 'lo', .2);
  for (let i = 0; i < 3; i++) { s.round(x + 12 + i * 16, y + 19, 4, 49, 9); s.round(x + 12 + i * 16, y + 19, 5, 58, 2); }
  s.screws(x, y, 58, 52, 6);
}
function safe(s, x, y, lit) {
  s.box(x, y, 62, 53, 0, 66, false, 'hi', 4); s.screws(x, y, 62, 53, 66);
  s.box(x + 5, y + 53, 52, 1, 5, 56, false, 'mid', 2);
  for (let i = 0; i < 3; i++) s.box(x + 8, y + 54, 7, 2, 11 + i * 18, 5, false, 'hi');
  for (let i = 0; i < 9; i++) s.box(x + 24 + i % 3 * 7, y + 54, 4, 1, 34 + Math.floor(i / 3) * 7, 4, lit && i === 4, 'lo');
  s.box(x + 24, y + 54, 22, 1, 20, 5, lit, 'hi');
  for (let i = 0; i < 9; i++) s.box(x + 5 + i * 5.6, y + 8, 2, 36, 66, .4, false, 'lo', .2);
}
// A real bowl section: the outside and inside are one closed meridian.
function dish(s, origin, axis, radius, lit = false) {
  const d = radius / 30;
  const profile = [[0,0],[0,3],[1.5,11],[5,21],[11,30],[13,30],[7,21],[3.5,11],[2,3],[2,0]].map(([a,r]) => [a*d,r*d]);
  s.turned(origin, axis, profile, lit, 'hi', true);
  const at = distance => origin.map((n,i) => n + axis[i] * distance);
  s.turned(at(2*d), axis, [[0,1.1*d],[23*d,1.1*d]], false, 'mid');
  s.turned(at(25*d), axis, [[0,3*d],[3*d,3*d]], false, 'hi');
}
function radar(s) {
  s.box(-69, -30, 80, 60, 0, 5, false, 'mid', 4); s.screws(-69,-30,80,60,5);
  s.round(-29,0,17,5,7); s.round(-29,0,7,12,30);
  s.round(-29,0,.3,42,9, false, 'hi');
  dish(s, [-29,0,51], [0,.8,.6], 35, true);
  s.cabinet(51,-18,31,36,42,3);
  for (const x of [-61,3]) for (const y of [-22,22]) s.round(x,y,2,5,2,false,'lo');

}
function aircraft(s) {
  for (const x of [-49,36]) s.box(x,-5,10,10,0,33,false,'lo');
  s.turned([-92,0,43], [1,0,0], [[0,1],[8,5],[20,9],[42,10],[135,10],[156,8],[174,4],[182,0]], true);
  for (const side of [-1,1]) {
    s.poly([[-9,side*10],[38,side*10],[-12,side*59],[-40,side*59]],40,3);
    s.box(-8,side < 0 ? -35 : 31,8,4,33,7,false,'mid');
    s.turned([12,side*33,27],[-1,0,0],[[0,4.7],[3,6],[23,6],[30,3.5]]);
    s.turned([12.6,side*33,27],[-1,0,0],[[0,4.5],[.6,4.5]]); s.material('glass');
    s.poly([[-75,side*10],[-52,side*10],[-72,side*28],[-89,side*28]],43,2);
  }
  const F={o:[0,-1.5,0],a:[0,1,0],u:[1,0,0],v:[0,0,1]};
  s.prism(F,[[-70,52],[-50,53],[-66,76],[-76,76]],0,3);
  for (let i=0;i<15;i++) {
    const x=-45+i*6;
    s.turned([x,9.57,45.9],[0,1,0],[[0,1.1],[.35,1.1]],false,'mid'); s.material('glass');
  }
  for (const [x,y] of [[62,7.65],[67,7]]) { s.turned([x,y,46],[0,1,0],[[0,.6],[.35,.6]],false,'mid'); s.material('glass'); }
}
function ship(s) {
  for (let i = 0; i < 7; i++) s.box(-77 + i * 23, -27, 8, 54, 0, 12, false, 'lo');
  s.poly([[-94, -26], [55, -26], [97, 0], [55, 26], [-94, 26]], 12, 21, true);
  s.box(-87, -20, 142, 40, 33, 3);
  const start = s.parts.length; s.building(-82, -17, 35, 34, 25, 'home');
  for (const part of s.parts.slice(start)) part.z += 36;
  for (let i = 0; i < 7; i++) { s.box(-39 + i * 13, -17, 10, 34, 36, 6, false, 'hi'); s.box(-36 + i * 13, -14, 4, 28, 42, .4, false, 'lo'); }
}
function rocket(s) {
  s.box(-48,-32,96,64,0,5,false,'mid',3); s.screws(-48,-32,96,64,5);
  // Slender core, two side boosters, and bell-shaped nozzles.
  for (const [x,r,height] of [[0,10,125],[-20,5.5,88],[20,5.5,88]]) {
    s.turned([x,0,5],[0,0,1],[[0,r*.85],[4,r*.5],[8,r*.7]],false,'lo');
    const bands=[24,height-10];
    let bottom=13;
    for(const z of bands){s.round(x,0,r,bottom,z-bottom,false,'hi');s.round(x,0,r+.35,z,1.5,false,'mid');bottom=z+1.5;}
    s.round(x,0,r,bottom,height-bottom,false,'hi');
    s.turned([x,0,height],[0,0,1],[[0,r],[5,r],[17,r*.65],[26,0]],x===0);

  }
  for (const x of [-14.5,10]) for (const z of [32,78]) s.box(x,-2,4.5,4,z,3,false,'lo');
  const F={o:[0,-1.5,0],a:[0,1,0],u:[1,0,0],v:[0,0,1]};
  for(const side of [-1,1]) s.prism(F,[[side*10,13],[side*13,13],[side*10,25]],0,3);
  // A narrow service mast leaves the rocket silhouette unobstructed.
  for(const x of [-45,-36]) s.box(x,-26,3,3,5,120,false,'lo');
  for(let i=0;i<9;i++) s.box(-42,-26,6,3,12+i*13,2,false,'mid');
  s.box(-33,-26,12,3,110,3,false,'mid');
}
function satellite(s) {
  // A small display fixture supports the representative spacecraft.
  s.box(-13,-10,26,20,0,3,false,'lo'); s.box(-3,-3,6,6,3,31,false,'lo');
  s.box(-17,-15,34,30,34,30,true,'hi',2); s.screws(-17,-15,34,30,64);
  for(const side of [-1,1]) {
    const x=side<0?-103:25;
    s.box(side<0?-25:17,-2,8,4,47,4,false,'mid');
    s.box(x,-23,78,46,47,2,false,'hi');
    for(let a=0;a<6;a++)for(let b=0;b<3;b++){
      s.box(x+2+a*12.5,-21+b*14,11,12,49,.5,false,'mid',.2);s.material('solar');
    }
  }
  s.round(0,0,.3,64,7,false,'mid');
  dish(s,[0,0,71],[0,.6,.8],17);
  for(const x of [-12,12]) { s.round(x,-10,1,64,16,false,'mid');s.round(x,-10,1.8,80,1,false,'hi'); }
  for(let i=0;i<5;i++)s.box(-12+i*5,15,3,.5,40,16,false,'lo',.2);
}
function reactor(s, x, y) {
  s.round(x, y, 28, 0, 4); s.round(x, y, 24, 4, 12);
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) s.round(x - 12 + a * 8, y - 12 + b * 8, 2.7, 16, 43, a === 2 && b === 2, 'hi');
  for (const a of [x - 19, x + 16]) for (const b of [y - 19, y + 16]) s.box(a, b, 3, 3, 16, 52);
  s.box(x - 21, y - 21, 42, 42, 68, 4); s.screws(x - 21, y - 21, 42, 42, 72);
}

// More specific representative activities for the source industry's 303 labels.
// Explicit mappings live in catalog.mjs. Shared scenes are disclosed in the coverage report.
const extra = (id, title, caption, parts, draw, note) => add(id, title, caption, parts, draw, note);
extra('electronics', '전자기기', '기판과 화면 등 부품을 조립해 전자기기를 만들어요.', ['화면', '전자 기판', '접속 부품'], s => { s.monitor(-86, -16, 0, true, 74); s.board(11, -28, 0, 75, 57); });
extra('software', '소프트웨어', '컴퓨터에서 작동하는 프로그램으로 업무를 처리해요.', ['업무 화면', '입력 장치', '작업 공간'], s => s.desk());
extra('media', '콘텐츠·미디어', '영상과 음향을 제작하고 이용자에게 전달해요.', ['제작 화면', '조작 장치', '콘텐츠 제작'], s => { s.desk(); for (let i = 0; i < 5; i++) s.box(17 + i * 8, -12, 4, 20, 37.2, 2, i === 2); });
extra('retail', '소매', '매장에 상품을 진열해 소비자에게 판매해요.', ['진열대', '상품', '매장 공간'], s => s.shelves());
extra('warehouse', '도매·물류', '제품을 보관하고 주문에 맞춰 출고해요.', ['보관 선반', '포장 상품', '출고 준비'], s => s.shelves('boxes', false));
extra('banking', '은행', '예금과 대출 등 금융 업무를 제공해요.', ['은행', '고객 공간', '업무 설비'], s => s.building(-60, -36, 120, 72, 58, 'office', true));
extra('insurance', '보험', '계약과 보장 내용을 관리하고 보험 서비스를 제공해요.', ['계약 서류', '업무 단말기', '보장 관리'], s => s.desk(), '보험 계약을 처리하는 사무 공간을 보여줘요. 보장 범위와 보험금은 계약마다 달라요.');
extra('asset-management', '자산운용', '여러 투자자산의 정보를 살펴보고 운용해요.', ['운용 단말기', '투자 자료', '분석 업무'], s => { s.monitor(-87, -9, 0, true, 71); s.monitor(9, -9, 0, false, 71); });
extra('construction', '건설', '기둥과 층을 쌓아 건물의 구조를 만들어요.', ['기초', '기둥', '층 구조'], s => {
  s.box(-78, -44, 156, 88, 0, 5); for (let r = 0; r < 3; r++) { const z = 5 + r * 26; for (const x of [-69, 62]) for (const y of [-35, 28]) s.box(x, y, 7, 7, z, 22); s.box(-78, -44, 156, 88, z + 22, 4); s.screws(-78, -44, 156, 88, z + 26); }
});
extra('housing', '주택', '주거 공간을 개발하거나 임대하고 관리해요.', ['주거 건물', '입주 공간', '관리 설비'], s => { s.building(-87, -34, 70, 65, 51, 'home', true); s.building(12, -26, 70, 56, 68, 'home'); });
extra('hotel', '숙박', '객실과 시설을 운영해 방문객에게 숙박 서비스를 제공해요.', ['객실 건물', '이용 공간', '운영 설비'], s => s.building(-64, -36, 128, 72, 68, 'office', true));
extra('medical-facility', '의료시설', '진료 공간과 의료시설을 운영하거나 임대해요.', ['의료시설', '진료 공간', '건물 설비'], s => { s.building(-62, -37, 124, 74, 61); s.box(-8, 35.7, 16, .5, 33, 29, true); s.box(-16, 36.2, 32, .5, 42, 11, true); });
extra('oil-tanks', '석유 저장·정제', '원유와 석유 제품을 저장하고 공급하는 설비예요.', ['저장 탱크', '관리 설비', '석유 제품'], s => { s.tank(-57, -10, 27, 64, true); s.tank(15, -10, 27, 48); s.cabinet(66, 3, 25, 28, 40, 3); });
extra('gas-supply', '가스 공급', '가스 저장·공급 설비를 운영해 연료를 전달해요.', ['가스 저장', '공급 설비', '제어 장치'], s => { s.tank(-52, -10, 29, 66); s.cabinet(16, -25, 66, 52, 66, 5, true); });
extra('water', '상하수도', '물 처리·공급 설비로 생활과 산업에 필요한 물을 관리해요.', ['처리조', '관리 장치', '공급 설비'], s => { s.tank(-52, -8, 29, 36, true); s.tank(24, -8, 29, 36); s.cabinet(-11, 33, 27, 22, 37, 3); });
extra('power-equipment', '전력 장비', '전력의 변환과 제어에 필요한 장비를 공급해요.', ['전력 변환 장치', '방열 구조', '제어 장비'], s => { transformer(s, -84, -28); s.cabinet(21, -28, 61, 54, 76, 6); });
extra('lab', '연구·진단', '시험 장비와 시료를 사용해 측정하고 연구해요.', ['시험 용기', '측정 장비', '분석 화면'], s => s.desk('lab'));
extra('medical-supplies', '의료용품', '진료와 치료에 필요한 용품을 생산·공급해요.', ['의료 용기', '제품 선반', '공급 준비'], s => s.shelves('bottles'));
extra('pharmacy', '의약품 소매', '의약품을 보관하고 판매하는 공간이에요.', ['의약품 선반', '제품 용기', '판매 준비'], s => s.shelves('bottles', false));
extra('food', '식품', '식품을 가공하고 포장해 공급해요.', ['생산 라인', '식품 용기', '포장 제품'], s => { s.conveyor(); for (let i = 0; i < 6; i++) s.box(-72 + i * 25, -8, 16, 20, 26.7, 14, i === 3, 'hi', 3); });
extra('beverages', '음료', '음료를 용기에 담고 포장해 공급해요.', ['충전 라인', '음료 용기', '출하 준비'], s => { s.conveyor(); for (let i = 0; i < 8; i++) s.bottle(-74 + i * 21, -2, 26.7, 5, 22, i === 3); });
extra('agriculture', '농업', '재배와 생산에 필요한 시설을 운영해 농산물을 얻어요.', ['재배 구획', '시설', '생산 관리'], s => { s.box(-90, -43, 180, 86, 0, 5); for (let a = 0; a < 8; a++) for (let b = 0; b < 5; b++) { s.box(-80 + a * 21, -33 + b * 15, 12, 9, 5, 2, false, 'lo'); s.round(-74 + a * 21, -28.5 + b * 15, 3.7, 7, 4, a === 3 && b === 2, 'hi'); } });
extra('fishing', '어업', '어선과 장비를 이용해 수산물을 생산해요.', ['어선', '작업 갑판', '운항 설비'], s => ship(s));
extra('mining', '금속·광업', '광물 원료를 채굴하고 선별해 산업에 공급해요.', ['원료', '운반 설비', '선별 준비'], s => { s.conveyor(); for (let i = 0; i < 6; i++) s.poly([[-70 + i * 25, -10], [-56 + i * 25, -10], [-51 + i * 25, 4], [-67 + i * 25, 10]], 26.7, 8 + i % 3 * 4, i === 3); });
extra('chemicals', '화학', '반응·저장 설비에서 여러 산업이 쓰는 화학제품을 만들어요.', ['반응 설비', '저장 용기', '공정 제어'], s => { s.tank(-50, -10, 28, 69, true); s.tank(23, -8, 23, 53); s.cabinet(67, 5, 24, 28, 42, 3); });
extra('machinery', '산업 기계', '정밀한 가공과 조립을 수행하는 기계를 공급해요.', ['기계 작업대', '가공 헤드', '제어 장치'], s => {
  s.bench(-83, -39, 166, 78, 17); s.box(-70, -31, 18, 58, 21, 55); s.box(52, -31, 18, 58, 21, 55); s.box(-70, -31, 140, 13, 76, 8); s.screws(-70, -31, 140, 13, 84);
  s.box(-15, -18, 30, 20, 65, 11); s.box(-7, -9, 14, 9, 48, 17, true); s.board(-41, -13, 21, 82, 48);
});
extra('truck', '도로 운송', '차량으로 화물을 목적지까지 운송해요.', ['화물칸', '운전실', '바퀴'], s => s.vehicle(-77, -29, 'truck'));
extra('rail', '철도 운송', '철도 차량이 정해진 선로를 따라 사람과 화물을 운송해요.', ['철도 차량', '선로', '운송 공간'], s => {
  for (let i = 0; i < 16; i++) s.box(-100 + i * 13, -34, 5, 68, 0, 3, false, 'lo');
  for (const y of [-23, 23]) s.box(-104, y, 208, 3, 3, 3, false, 'hi');
  s.box(-86, -21, 172, 44, 6, 9); s.box(-86, -20, 172, 42, 15, 36, true, 'hi', 6);
  for (let i = 0; i < 12; i++) s.box(-77 + i * 13, 22, 8, .4, 32, 11, false, 'lo', 1);
});
extra('airline', '항공 운송', '항공기를 운항해 승객과 화물을 운송해요.', ['항공기', '운항 장비', '기체'], s => aircraft(s));
extra('shipping', '해상 운송', '선박을 운항해 화물을 목적지까지 운송해요.', ['화물선', '화물 공간', '운항 설비'], s => ship(s));
extra('apparel', '의류·섬유', '직물과 의류를 만들거나 유통해요.', ['원단 선반', '섬유 제품', '공급 준비'], s => { s.shelves('books'); });
extra('paper', '종이·포장', '종이와 포장재를 생산해 여러 산업에 공급해요.', ['생산 라인', '종이 적층', '포장재'], s => { s.conveyor(); for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) s.box(-72 + i * 31, -10, 25, 24, 26.7 + j * 1.5, 1.5, i === 2 && j === 4, 'hi'); });
extra('wood', '목재', '목재를 가공해 건축과 생활용품의 재료로 공급해요.', ['운반 라인', '가공 목재', '공급 준비'], s => { s.conveyor(); for (let i = 0; i < 6; i++) s.box(-74 + i * 25, -11, 16, 24, 26.7, 15, i === 3, 'hi'); });
extra('furniture', '가구·가전', '생활 공간에서 쓰는 가구와 기기를 공급해요.', ['책상', '가정용 기기', '생활 공간'], s => s.desk());
extra('publishing', '출판·인쇄', '책과 인쇄물을 제작하고 공급해요.', ['도서 선반', '인쇄물', '공급 준비'], s => s.shelves('books', false));
extra('education', '교육', '교실과 학습 장비로 교육 서비스를 제공해요.', ['학습 화면', '교재', '학습 공간'], s => s.desk());
extra('business-services', '사업 서비스', '전문 인력과 업무 시스템으로 고객의 일을 도와요.', ['업무 단말기', '작업 자료', '업무 공간'], s => s.desk(), '업무 공간의 대표 장면이에요. 자문·인력·관리 서비스는 회사별로 실제 제공 내용을 확인해야 해요.');
extra('recycling', '폐기물·재활용', '수거한 자원을 분류하고 처리해요.', ['선별 라인', '분리 용기', '회수 자원'], s => { s.conveyor(); for (let i = 0; i < 5; i++) { s.box(-72 + i * 32, -11, 21, 25, 26.7, 16, i === 2, 'hi'); s.box(-70 + i * 32, -9, 17, 21, 42.7, 1, false, 'lo'); } });
extra('optics', '광학·계측', '렌즈와 정밀 장치로 빛을 다루거나 측정해요.', ['광학 작업대', '렌즈 지지대', '측정 장치'], s => {
  s.bench(-89, -36, 178, 72, 17); for (let i = 0; i < 5; i++) { s.box(-75 + i * 32, -14, 22, 28, 21, 5); s.box(-70 + i * 32, -9, 12, 18, 26, 19); s.round(-64 + i * 32, 0, 9, 45, 3, i === 2, 'hi'); s.screws(-75 + i * 32, -14, 22, 28, 26); }
});
extra('restaurant', '외식', '조리 공간에서 음식을 준비해 고객에게 제공해요.', ['조리대', '조리 용기', '주문 준비'], s => { s.bench(-86, -38, 172, 76, 33); for (let i = 0; i < 4; i++) { s.round(-62 + i * 41, 0, 14, 37, 4, i === 1, 'hi'); s.round(-62 + i * 41, 0, 11, 41, 2); s.box(-62 + i * 41, 14, 4, 13, 38, 3); } for (let i = 0; i < 10; i++) s.box(-72 + i * 16, -30, 9, 5, 37, 2, false, 'lo'); });
extra('leisure', '여가·오락', '체험과 놀이 시설을 운영해 여가 서비스를 제공해요.', ['오락 장비', '조작부', '이용 공간'], s => { s.cabinet(-72, -29, 58, 59, 76, 5); s.monitor(17, -16, 0, true, 63); s.board(18, 20, 0, 60, 21); });
extra('jewelry', '귀금속·잡화', '장신구와 소비재를 제작하거나 판매해요.', ['제품 진열대', '장신구', '판매 공간'], s => { s.bench(-87, -37, 174, 74, 22); for (let i = 0; i < 8; i++) { s.box(-75 + i * 21, -21, 15, 42, 26, 2); s.round(-67.5 + i * 21, 0, 6, 28, 4, i === 3, 'hi'); s.round(-67.5 + i * 21, 0, 3, 32, .5); } });
extra('cables', '전선·케이블', '전력과 신호를 전달하는 케이블을 생산해요.', ['케이블 단면', '도체', '절연 구조'], s => {
  s.box(-83, -34, 166, 68, 0, 4); for (let i = 0; i < 7; i++) { s.round(-67 + i * 22, 0, 9, 4, 38, false, 'hi'); s.round(-67 + i * 22, 0, 6, 42, 3, i === 3, 'hi'); for (let a = 0; a < 6; a++) s.round(-67 + i * 22 + Math.cos(a * Math.PI / 3) * 3.4, Math.sin(a * Math.PI / 3) * 3.4, 1, 45, .7, false, 'lo'); }
});
extra('appliances', '가정용 기기', '가정에서 사용하는 전기기기를 만들어요.', ['제품 본체', '조작부', '부품'], s => { s.cabinet(-77, -30, 62, 58, 75, 4); s.cabinet(15, -30, 62, 58, 75, 3, true); });
extra('tobacco', '담배', '담배 제품을 가공하고 포장해 판매해요.', ['포장 라인', '제품 포장', '출하 준비'], s => { s.conveyor(); for (let i = 0; i < 7; i++) s.box(-74 + i * 23, -11, 14, 23, 26.7, 23, i === 3, 'hi'); });
extra('auto-parts', '자동차 부품', '자동차에 들어가는 부품과 제어 장치를 공급해요.', ['부품 기판', '가공 부품', '제어 장치'], s => { s.board(-84, -33, 0, 90, 66, true); for (let i = 0; i < 5; i++) s.tank(30 + i % 2 * 37, -23 + Math.floor(i / 2) * 25, 8, 15); });
extra('coal', '석탄', '석탄을 채굴하고 선별해 연료와 제철 원료로 공급해요.', ['석탄 원료', '선별 라인', '공급 준비'], s => { s.conveyor(); for (let i = 0; i < 7; i++) s.box(-75 + i * 23, -9, 15, 19, 26.7, 10 + i % 3 * 3, i === 3, 'lo', 3); });

extra('mortgage-finance', '부동산 금융', '주택담보 대출과 부동산 관련 금융자산을 다뤄요.', ['대출 자료', '업무 단말기', '금융 검토'], s => s.desk(), '주택담보 금융과 모기지 리츠의 업무를 보여주는 대표 장면이에요. 건물을 직접 임대하는 사업과는 달라요.');
extra('reit-industrial', '산업시설 리츠', '산업시설과 물류센터 같은 부동산을 임대·운용해요.', ['산업시설 건물', '임대 공간', '건물 관리'], s => s.building(-84, -36, 168, 72, 34, 'office', true));
extra('reit-retail', '상업시설 리츠', '쇼핑센터 같은 상업용 부동산을 임대·운용해요.', ['상업시설 건물', '입점 공간', '건물 관리'], s => s.building(-86, -36, 172, 72, 40, 'office', true));
extra('physical-security', '시설 보안·경비', '출입 통제와 경비 서비스로 사람과 시설을 보호해요.', ['출입문', '통제 장치', '관리 공간'], s => {
  s.building(-90, -29, 44, 48, 40, 'home');
  for (const x of [-26, 80]) s.box(x, -8, 8, 10, 0, 79);
  s.box(-18, -8, 98, 10, 73, 6); s.box(-18, -8, 98, 10, 5, 6);
  for (let i = 0; i < 11; i++) s.box(-14 + i * 8, -5, 3, 4, 11, 62, i === 5, 'hi');
  s.box(80, 2, 8, 2, 45, 12, true);
});
extra('travel', '여행 서비스', '예약과 여행 정보를 연결해 여행 준비를 도와요.', ['예약 화면', '여행 자료', '업무 공간'], s => s.desk());
extra('lighting', '조명 장치', '빛을 내는 광원과 이를 제어하는 조명 장치를 만들어요.', ['광원', '방열 구조', '장치 기판'], s => {
  s.board(-88, -34, 0, 176, 68, false, false);
  for (let i = 0; i < 5; i++) { s.round(-65 + i * 33, 0, 12, 2, 5); s.round(-65 + i * 33, 0, 9, 7, 4, i === 2, 'hi'); s.round(-65 + i * 33, 0, 5, 11, 1, false, 'hi'); }
});
extra('musical-instruments', '악기', '크기가 다른 음판을 배치해 소리를 내는 악기를 만들어요.', ['음판', '지지 구조', '악기 몸체'], s => {
  s.bench(-91, -40, 182, 80, 23);
  for (const y of [-18, 18]) s.box(-83, y, 166, 5, 27, 3);
  for (let i = 0; i < 14; i++) { s.box(-81 + i * 12, -33 + i * 1.5, 9, 65 - i * 3, 30, 4, i === 5, 'hi'); s.round(-76.5 + i * 12, 0, .75, 34, .5); }
});
extra('renewable-generation', '재생에너지 발전', '태양광 같은 재생에너지 설비를 운영해 전기를 생산해요.', ['발전 패널', '전력 변환', '운영 설비'], s => { s.solar(-91, -35, 11, true); s.cabinet(45, -21, 43, 43, 61, 5); });

export const SCENES = entries;
export const CORE_SCENE_IDS = entries.slice(0, 42).map(x => x.id);
