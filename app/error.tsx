'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:24}}><div><h1>Não foi possível conectar</h1><p>Tente novamente em instantes.</p><button className="button primary" onClick={reset}>Tentar novamente</button></div></main>;}
