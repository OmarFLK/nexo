'use client';
import {useState,type FormEvent} from 'react';
import {ArrowRight,Eye,EyeOff} from 'lucide-react';
import './login.css';
export default function LoginForm(){
  const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;setBusy(true);setError('');const data=new FormData(event.currentTarget);
    try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),password:data.get('password')})});const body=await response.json();if(!response.ok)throw Error(body.error||'Não foi possível entrar.');window.location.replace('/');}
    catch(error){setError(error instanceof Error?error.message:'Não foi possível conectar. Tente novamente.');setBusy(false);}
  }
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title"><div className="login-brand">NEXO<span>.</span></div><div className="login-intro"><h1 id="login-title">Entre na sua conta</h1><p>Acesse sua loja.</p></div><form onSubmit={submit} aria-busy={busy}>
    <label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="Seu e-mail" required maxLength={254} disabled={busy}/>
    <label htmlFor="password">Senha</label><div className="login-password"><input id="password" name="password" type={visible?'text':'password'} autoComplete="current-password" placeholder="Sua senha" required maxLength={256} disabled={busy}/><button type="button" aria-label={visible?'Ocultar senha':'Mostrar senha'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
    {error&&<p className="login-error" role="alert">{error}</p>}<button className="login-submit" disabled={busy} type="submit">{busy?'Entrando…':'Entrar'}<ArrowRight size={20}/></button>
  </form></section></main>;
}
