import { notFound } from 'next/navigation';
import DictionaryBookPreview from '@/components/learning/DictionaryBookPreview';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DictionaryBookPreview />;
}
