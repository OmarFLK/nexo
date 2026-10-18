import Workspace from './workspace';
import {redirect} from 'next/navigation';
import {pageSession} from '../server/page-session';
export const dynamic='force-dynamic';
export default async function Home() { const session=await pageSession();if(!session)redirect('/login');return <Workspace session={session}/>; }
