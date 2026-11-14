import { notFound } from 'next/navigation';
import DictionaryMaterialPreview from './DictionaryMaterialPreview';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DictionaryMaterialPreview />;
}
