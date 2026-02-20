import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDocsUrl } from '@/lib/docs-url';

export default function DocsRedirectPage() {
  const { slug } = useParams<{ slug?: string }>();

  useEffect(() => {
    window.location.assign(getDocsUrl(slug));
  }, [slug]);

  return (
    <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
      Redirecting to documentation...
    </div>
  );
}
