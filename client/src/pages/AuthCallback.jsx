import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    if (error) {
      navigate('/login?error=' + encodeURIComponent(error), { replace: true });
      return;
    }
    if (token) {
      localStorage.setItem('token', token);
      window.location.href = '/';
      return;
    }
    navigate('/login', { replace: true });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-primary-400 animate-spin" />
        <p className="text-slate-400">Completing sign in...</p>
      </div>
    </div>
  );
}
