import { notFound } from 'next/navigation';
import DictionaryCurlPreview from '@/components/learning/DictionaryCurlPreview';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DictionaryCurlPreview />;
}
