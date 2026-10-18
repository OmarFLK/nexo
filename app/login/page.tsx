import {redirect} from 'next/navigation';
import {pageSession} from '../../server/page-session';
import LoginForm from './login-form';
export const dynamic='force-dynamic';
export const metadata={title:'Entrar · Nexo',robots:{index:false,follow:false}};
export default async function LoginPage(){if(await pageSession())redirect('/');return <LoginForm/>;}
