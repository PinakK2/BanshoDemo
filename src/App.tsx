import { useEffect, useState } from 'react';
import { Home } from './components/Home';
import { NewProject } from './components/NewProject';
import { Workspace } from './components/Workspace';
import { Presenter } from './components/Presenter';
import { Toasts } from './components/ui';
import { useStore } from './store';

type Route = { name: 'home' } | { name: 'new' } | { name: 'project'; id: string };

function parse(): Route {
  const h = location.hash.replace(/^#/, '');
  if (h === 'new') return { name: 'new' };
  if (h.startsWith('project-')) return { name: 'project', id: h.slice(8) };
  return { name: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parse);
  const [presenter, setPresenter] = useState(false);
  const projects = useStore((s) => s.projects);

  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setPresenter((v) => !v); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const go = (r: Route) => {
    const hash = r.name === 'home' ? '' : r.name === 'new' ? 'new' : `project-${r.id}`;
    if (hash) location.hash = hash; else history.replaceState(null, '', location.pathname + location.search);
    setRoute(r);
  };

  let view;
  if (route.name === 'project' && projects[route.id]) {
    view = <Workspace key={route.id} projectId={route.id} onHome={() => go({ name: 'home' })} />;
  } else if (route.name === 'new') {
    view = <NewProject onCancel={() => go({ name: 'home' })} onCreated={(id) => go({ name: 'project', id })} />;
  } else {
    view = <Home onOpen={(id) => go({ name: 'project', id })} onNew={() => go({ name: 'new' })} onPresenter={() => setPresenter(true)} />;
  }

  return (
    <>
      {view}
      {presenter && <Presenter onClose={() => setPresenter(false)} onHome={() => go({ name: 'home' })} />}
      <Toasts />
    </>
  );
}
