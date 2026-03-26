# SOLB PORTFOLIO — Google/Kakao 로그인 설정 가이드

## 왜 이걸 해야 하나요?

SOLB에서 "Google로 시작하기" / "카카오로 시작하기" 버튼을 누르면, Google이나 Kakao가 **"이 앱이 진짜 맞아?"**를 확인합니다.

아무 앱이나 "Google 로그인"을 만들면 안 되니까, Google/Kakao에 **"나는 SOLB PORTFOLIO라는 앱이고, 이 주소에서 로그인을 할 거야"**라고 미리 등록해야 합니다.

이 등록 과정을 **OAuth 설정**이라고 합니다. 한 번만 하면 끝입니다.

---

## 1단계: Google 로그인 설정 (10분)

### 1-1. Google Cloud Console 접속

1. https://console.cloud.google.com 접속
2. Google 계정으로 로그인 (SOLB 개발에 사용하는 계정)

### 1-2. 프로젝트 만들기

1. 화면 상단의 프로젝트 선택 드롭다운 클릭
2. **"새 프로젝트"** 클릭
3. 프로젝트 이름: `solb-portfolio`
4. **"만들기"** 클릭
5. 생성 완료되면 해당 프로젝트가 선택되었는지 확인

### 1-3. OAuth 동의 화면 설정

> **이게 뭔가요?**
> 사용자가 Google 로그인할 때 "SOLB PORTFOLIO가 당신의 이메일을 사용하려 합니다" 화면이 나옵니다.
> 이 화면에 어떤 정보를 보여줄지 설정하는 겁니다.

1. 왼쪽 메뉴 → **"API 및 서비스"** → **"OAuth 동의 화면"**
2. User Type: **"외부"** 선택 → **"만들기"**
3. 앱 정보 입력:
   - 앱 이름: `SOLB PORTFOLIO`
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처 이메일: 본인 이메일
4. **"저장 후 계속"** (나머지는 기본값 유지, 계속 "저장 후 계속" 클릭)
5. 마지막에 **"대시보드로 돌아가기"**

### 1-4. OAuth 클라이언트 ID 만들기

> **이게 뭔가요?**
> Google이 SOLB 앱을 식별하는 "신분증"입니다.
> Client ID = 이름표, Client Secret = 비밀번호

1. 왼쪽 메뉴 → **"API 및 서비스"** → **"사용자 인증 정보"**
2. 상단 **"+ 사용자 인증 정보 만들기"** → **"OAuth 클라이언트 ID"**
3. 애플리케이션 유형: **"웹 애플리케이션"**
4. 이름: `SOLB Portfolio`
5. **승인된 리디렉션 URI** (중요!):
   - **"+ URI 추가"** 클릭
   - 입력: `https://ytowigkzunbrhyucbsqu.supabase.co/auth/v1/callback`

   > **이 주소가 뭔가요?**
   > 사용자가 Google 로그인을 마치면, Google이 "로그인 성공했어!"라고
   > 이 주소로 알려줍니다. Supabase가 이걸 받아서 처리합니다.

6. **"만들기"** 클릭
7. 팝업에 **클라이언트 ID**와 **클라이언트 보안 비밀번호**가 나옵니다
8. **둘 다 복사해서 저장해두세요** (메모장에)

### 1-5. Supabase에 Google 연동

1. https://supabase.com/dashboard → SOLB 프로젝트 선택
2. 왼쪽 메뉴 → **"Authentication"** → **"Providers"**
3. **"Google"** 찾아서 클릭
4. **Enable** 토글 ON
5. 입력:
   - Client ID: 방금 복사한 클라이언트 ID
   - Client Secret: 방금 복사한 클라이언트 보안 비밀번호
6. **"Save"** 클릭

### 1-6. 테스트 사용자 추가 (선택)

> Google OAuth가 "테스트" 모드일 때, 등록한 이메일만 로그인 가능합니다.
> 프로덕션으로 전환하면 누구나 가능하지만, 처음에는 테스트 모드로 시작합니다.

1. Google Cloud Console → **"OAuth 동의 화면"**
2. **"테스트 사용자"** 섹션 → **"+ ADD USERS"**
3. 본인 이메일 추가
4. **"저장"**

### ✅ Google 로그인 완료!

---

## 2단계: Kakao 로그인 설정 (10분)

### 2-1. Kakao Developers 접속

1. https://developers.kakao.com 접속
2. 카카오 계정으로 로그인
3. 상단 **"내 애플리케이션"** 클릭

### 2-2. 앱 만들기

1. **"애플리케이션 추가하기"** 클릭
2. 앱 정보:
   - 앱 이름: `SOLB PORTFOLIO`
   - 사업자명: 본인 이름
3. **"저장"** 클릭
4. 만들어진 앱 클릭해서 들어가기

### 2-3. REST API 키 확인

1. **"앱 키"** 섹션에서 **REST API 키** 복사

   > **이게 뭔가요?**
   > Google의 Client ID와 같은 역할입니다.
   > Kakao가 SOLB 앱을 식별하는 이름표예요.

2. 메모장에 저장

### 2-4. Client Secret 발급

1. 왼쪽 메뉴 → **"보안"** (또는 "카카오 로그인" → "보안")
2. **Client Secret** → **"코드 발급"** 클릭
3. 상태: **"사용"**으로 변경
4. 발급된 코드 복사 → 메모장에 저장

### 2-5. 카카오 로그인 활성화

1. 왼쪽 메뉴 → **"카카오 로그인"**
2. **활성화 설정** → **ON**
3. **Redirect URI** 설정:
   - **"+ Redirect URI 등록"** 클릭
   - 입력: `https://ytowigkzunbrhyucbsqu.supabase.co/auth/v1/callback`

   > Google과 같은 주소입니다. Supabase가 카카오 로그인도 처리합니다.

### 2-6. 동의 항목 설정

> **이게 뭔가요?**
> 사용자가 카카오 로그인할 때 "SOLB가 닉네임과 이메일을 사용하려 합니다"
> 어떤 정보를 받을지 설정합니다.

1. 왼쪽 메뉴 → **"카카오 로그인"** → **"동의항목"**
2. 설정할 항목:
   - **닉네임**: 필수 동의
   - **프로필 사진**: 선택 동의 (또는 필수)
   - **카카오계정(이메일)**: 선택 동의
3. **"저장"**

### 2-7. Supabase에 Kakao 연동

1. Supabase 대시보드 → **"Authentication"** → **"Providers"**
2. **"Kakao"** 찾아서 클릭
3. **Enable** 토글 ON
4. 입력:
   - Client ID: Kakao **REST API 키**
   - Client Secret: Kakao에서 발급한 **Client Secret 코드**
5. **"Save"** 클릭

### ✅ Kakao 로그인 완료!

---

## 3단계: Vercel 환경변수 확인

Vercel에 이미 추가한 환경변수가 맞는지 확인:

| 변수명 | 값 |
|--------|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ytowigkzunbrhyucbsqu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` |
| `GEMINI_API_KEY` | `AIzaSy...` |

이 3개가 Vercel Settings → Environment Variables에 있으면 됩니다.

---

## 4단계: 테스트

1. 로컬에서: `http://localhost:3001` → "로그인" 클릭 → Google/Kakao 버튼
2. 배포 후: `solb-portfolio.vercel.app` → 동일하게 테스트

### 문제가 생기면?

| 증상 | 원인 | 해결 |
|------|------|------|
| "redirect_uri_mismatch" | Redirect URI가 안 맞음 | Google/Kakao에 등록한 URI 확인 |
| "access_denied" | 테스트 사용자 미등록 | Google OAuth 동의화면에서 이메일 추가 |
| 로그인 후 빈 화면 | Supabase Provider 설정 안 됨 | Supabase → Providers에서 Enable 확인 |
| "invalid_client" | Client ID/Secret 오타 | 복사-붙여넣기 다시 확인 |

---

## 요약

```
Google Cloud Console                    Supabase
  ├── 프로젝트 생성                       ├── Providers → Google
  ├── OAuth 동의 화면                     │   ├── Client ID 입력
  ├── OAuth 클라이언트 ID 생성            │   └── Client Secret 입력
  │   ├── Client ID ─────────────────→  │
  │   └── Client Secret ─────────────→  │
  └── Redirect URI 등록                  └── 완료!
      (supabase callback URL)

Kakao Developers                        Supabase
  ├── 앱 생성                             ├── Providers → Kakao
  ├── REST API 키 ─────────────────────→ │   ├── Client ID 입력
  ├── Client Secret 발급 ──────────────→ │   └── Client Secret 입력
  ├── 카카오 로그인 활성화                 └── 완료!
  ├── Redirect URI 등록
  └── 동의항목 설정
```

전체 과정: 약 20분. 한 번만 하면 됩니다!
