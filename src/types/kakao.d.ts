interface KakaoShareLink {
  mobileWebUrl: string;
  webUrl: string;
}

interface KakaoShareOptions {
  objectType: 'feed';
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: KakaoShareLink;
  };
  buttons?: Array<{
    title: string;
    link: KakaoShareLink;
  }>;
}

interface KakaoSdk {
  init(key: string): void;
  isInitialized(): boolean;
  Share?: {
    sendDefault(options: KakaoShareOptions): void;
  };
}

interface Window {
  Kakao?: KakaoSdk;
}
