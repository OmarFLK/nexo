'use client';
import {useState,type FormEvent} from 'react';
import {Plus,Search,Pencil,Trash2,Check,NotebookPen} from 'lucide-react';
import type {Note} from '../lib/domain';
import {Field,shortDate} from './ui';
import './notes.css';

export default function Notes({notes,ready,busy,run}:{notes:Note[];ready:boolean;busy:boolean;run:(type:string,payload:Record<string,unknown>)=>Promise<boolean>}){
  const [editing,setEditing]=useState<{id?:string;title:string;body:string}|null>(null);
  const [search,setSearch]=useState('');const [deleting,setDeleting]=useState<string|null>(null);
  const filtered=notes.filter(n=>(n.title+' '+n.body).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(editing&&await run('note',editing))setEditing(null);}
  return <section className="notes-area" aria-label="Suas notas">
    <div className="notes-toolbar"><div className="search"><Search size={20}/><input aria-label="Buscar notas" placeholder="Buscar nas notas" value={search} onChange={e=>setSearch(e.target.value)}/></div><button className="button primary" disabled={!ready||busy||editing!==null} onClick={()=>{setDeleting(null);setEditing({title:'',body:''});}}><Plus size={18}/>Nova nota</button></div>
    {editing&&<form className="panel note-editor" onSubmit={save}>
      <h2>{editing.id?'Editar nota':'Nova nota'}</h2>
      <Field label="Título"><input name="noteTitle" autoFocus required maxLength={120} value={editing.title} disabled={busy} onChange={e=>setEditing({...editing,title:e.target.value})} placeholder="Sobre o que é a nota?"/></Field>
      <Field label="Anotação"><textarea name="noteBody" required maxLength={10000} rows={8} value={editing.body} disabled={busy} onChange={e=>setEditing({...editing,body:e.target.value})} placeholder="Escreva aqui…"/></Field>
      <div className="note-editor-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setEditing(null)}>Cancelar</button><button className="button primary" disabled={busy||!editing.title.trim()||!editing.body.trim()}><Check size={18}/>{busy?'Salvando…':'Salvar nota'}</button></div>
    </form>}
    {!editing&&ready&&!filtered.length&&<div className="panel notes-empty"><NotebookPen size={30}/><h2>{search?'Nenhuma nota encontrada':'Suas anotações ficam aqui'}</h2><p>{search?'Tente buscar por outra palavra.':'Crie uma nota para guardar ideias, lembretes e informações da loja.'}</p></div>}
    <div className="notes-grid">{filtered.map(note=><article className="panel note-card" key={note.id}>
      <h2>{note.title}</h2><p className="note-text">{note.body}</p><small>Atualizada em {shortDate(note.updatedAt)}</small>
      {deleting===note.id?<div className="note-delete-confirm"><p>Excluir esta nota?</p><div><button className="button secondary" disabled={busy} onClick={()=>setDeleting(null)}>Voltar</button><button className="button secondary negative" disabled={busy} onClick={async()=>{if(await run('deleteNote',{id:note.id}))setDeleting(null);}}>Confirmar exclusão</button></div></div>:<div className="note-actions"><button className="button plain" disabled={busy||editing!==null} onClick={()=>{setDeleting(null);setEditing({id:note.id,title:note.title,body:note.body});}}><Pencil size={16}/>Editar</button><button className="icon-button" aria-label={'Excluir nota '+note.title} disabled={busy||editing!==null} onClick={()=>setDeleting(note.id)}><Trash2 size={18}/></button></div>}
    </article>)}</div>
  </section>;
}
