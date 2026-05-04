import React, { useState } from 'react';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthProps {
  onSuccess: () => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Iltimos, barcha maydonlarni to'ldiring.");
      return;
    }
    if (!isLogin && (!firstName || !lastName)) {
      setError("Iltimos, ism va familiyani kiriting.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const fakeEmail = `${cleanUsername}@shishacalendar.local`;

      if (isLogin) {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
        onSuccess();
      } else {
        if (password.length < 6) {
           setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
           setLoading(false);
           return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        const user = userCredential.user;
        
        // Update auth profile
        await updateProfile(user, { displayName: `${firstName} ${lastName}` });
        
        // Save to Firestore
        await setDoc(doc(db, 'users', user.uid), {
          firstName,
          lastName,
          username: cleanUsername,
          createdAt: serverTimestamp()
        });

        onSuccess();
      }
    } catch (err: any) {
      console.warn("Login failed:", err.message);
      if (err.code === 'auth/email-already-in-use') {
        setError("Bu username band. Boshqa tanlang.");
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Username yoki parol noto'g'ri. Agar yangi bo'lsangiz, avval ro'yxatdan o'ting.");
      } else if (err.code === 'auth/weak-password') {
        setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Username noto'g'ri formatda. Faqat harf va raqam ishlating.");
      } else {
        setError("Xatolik yuz berdi. Iltimos qayta urinib ko'ring: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden font-sans text-white">
      {/* Animated Background Orbs */}
      <div className="orb w-[400px] h-[400px] bg-purple-600 top-[-100px] left-[-50px] opacity-40"></div>
      <div className="orb w-[500px] h-[500px] bg-blue-500 bottom-[-150px] right-[-50px] opacity-30"></div>
      <div className="orb w-[300px] h-[300px] bg-pink-500 top-[20%] right-[-100px] opacity-20"></div>

      <div className="glass w-full max-w-sm rounded-[2rem] p-8 z-10 border border-white/20 relative shadow-2xl">
        <h2 className="text-3xl font-bold mb-2 text-center">
          {isLogin ? 'Xush kelibsiz' : "Ro'yxatdan o'tish"}
        </h2>
        <p className="text-white/60 text-center mb-8 text-sm">
          {isLogin ? "Ma'lumotlaringizni kiriting" : "Yangi akkaunt yarating"}
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-sm p-3 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Ismingiz"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 outline-none focus:ring-1 focus:ring-white/50 placeholder:text-white/40 text-white font-medium transition-all"
              />
              <input
                type="text"
                placeholder="Familiyangiz"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 outline-none focus:ring-1 focus:ring-white/50 placeholder:text-white/40 text-white font-medium transition-all"
              />
            </>
          )}

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 outline-none focus:ring-1 focus:ring-white/50 placeholder:text-white/40 text-white font-medium transition-all lowercase"
          />

          <input
            type="password"
            placeholder="Kod (parol)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 outline-none focus:ring-1 focus:ring-white/50 placeholder:text-white/40 text-white font-medium transition-all"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-slate-900 bg-white hover:bg-white/90 transition-all mt-4 disabled:opacity-50"
          >
            {loading ? 'Kuting...' : (isLogin ? 'Kirish' : "Ro'yxatdan o'tish")}
          </button>
        </form>

        <p className="text-center text-sm text-white/50 mt-6">
          {isLogin ? "Akkauntingiz yo'qmi?" : "Allaqachon ro'yxatdan o'tganmisiz?"}{' '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-white font-bold underline decoration-white/30 hover:decoration-white underline-offset-4 transition-all"
          >
            {isLogin ? "Ro'yxatdan o'tish" : "Kirish"}
          </button>
        </p>
      </div>
    </div>
  );
}
