import { notFound } from 'next/navigation';
import MotionPreview from './MotionPreview';
export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <MotionPreview />;
}
