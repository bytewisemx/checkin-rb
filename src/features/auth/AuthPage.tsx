import { useState, useEffect } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useNavigate } from 'react-router-dom';
import './AuthPage.css';

export function AuthPage() {
  const login = useCheckinStore(state => state.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpened, setIsOpened] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > window.innerHeight / 3 && !isOpened) {
        setIsOpened(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpened(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpened]);

  // Manejar bloqueo de scroll
  useEffect(() => {
    if (isOpened) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'initial';
    }
    return () => {
      document.body.style.overflow = 'initial';
    }
  }, [isOpened]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      const success = login(email, password);
      setIsLoading(false);
      if (success) {
        navigate('/');
      }
    }, 600);
  };

  return (
    <div className="auth-body">
      {!isOpened && (
        <div className="auth-scroll-down">
          SCROLL DOWN
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <path d="M16 3C8.832031 3 3 8.832031 3 16s5.832031 13 13 13 13-5.832031 13-13S23.167969 3 16 3zm0 2c6.085938 0 11 4.914063 11 11 0 6.085938-4.914062 11-11 11-6.085937 0-11-4.914062-11-11C5 9.914063 9.914063 5 16 5zm-1 4v10.28125l-4-4-1.40625 1.4375L16 23.125l6.40625-6.40625L21 15.28125l-4 4V9z"/> 
          </svg>
        </div>
      )}
      
      <div className="auth-container"></div>
      
      <div className={`auth-modal ${isOpened ? 'is-open' : ''}`}>
        <div className="auth-modal-container">
          <div className="auth-modal-left">
            <h1 className="auth-modal-title">Welcome!</h1>
            <p className="auth-modal-desc">Inicia sesión para acceder a Checkin Russell Bedford.</p>
            
            <form onSubmit={handleLogin}>
              <div className="auth-input-block">
                <label htmlFor="email" className="auth-input-label">Email</label>
                <input 
                  type="email" 
                  name="email" 
                  id="email" 
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="auth-input-block">
                <label htmlFor="password" className="auth-input-label">Password</label>
                <input 
                  type="password" 
                  name="password" 
                  id="password" 
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="bg-blue-50/50 p-2 text-[10px] rounded mb-4 text-blue-800">
                Pruebas: <b>empleado@russellbedford.mx</b> o <b>supervisor@russellbedford.mx</b><br/>Pass: <b>admin123</b>
              </div>

              <div className="auth-modal-buttons">
                <a href="#">Forgot your password?</a>
                <button type="submit" className="auth-input-button" disabled={isLoading}>
                  {isLoading ? 'Cargando...' : 'Login'}
                </button>
              </div>
            </form>
            
            <p className="auth-sign-up">Don't have an account? <a href="#">Sign up now</a></p>
          </div>
          <div className="auth-modal-right">
            <img src="https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?ixlib=rb-0.3.5&ixid=eyJhcHBfaWQiOjEyMDd9&s=dfd2ec5a01006fd8c4d7592a381d3776&auto=format&fit=crop&w=1000&q=80" alt="" />
          </div>
          <button type="button" className="auth-icon-button close-button" onClick={() => setIsOpened(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
              <path d="M 25 3 C 12.86158 3 3 12.86158 3 25 C 3 37.13842 12.86158 47 25 47 C 37.13842 47 47 37.13842 47 25 C 47 12.86158 37.13842 3 25 3 z M 25 5 C 36.05754 5 45 13.94246 45 25 C 45 36.05754 36.05754 45 25 45 C 13.94246 45 5 36.05754 5 25 C 5 13.94246 13.94246 5 25 5 z M 16.990234 15.990234 A 1.0001 1.0001 0 0 0 16.292969 17.707031 L 23.585938 25 L 16.292969 32.292969 A 1.0001 1.0001 0 1 0 17.707031 33.707031 L 25 26.414062 L 32.292969 33.707031 A 1.0001 1.0001 0 1 0 33.707031 32.292969 L 26.414062 25 L 33.707031 17.707031 A 1.0001 1.0001 0 0 0 32.980469 15.990234 A 1.0001 1.0001 0 0 0 32.292969 16.292969 L 25 23.585938 L 17.707031 16.292969 A 1.0001 1.0001 0 0 0 16.990234 15.990234 z"></path>
            </svg>
          </button>
        </div>
        <button type="button" className="auth-modal-button" onClick={() => setIsOpened(true)}>Click here to login</button>
      </div>
    </div>
  );
}
