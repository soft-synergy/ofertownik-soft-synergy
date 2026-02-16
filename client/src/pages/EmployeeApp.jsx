import React from 'react';
import { calls, recordings } from '../services/ccm';

export default function EmployeeApp() {
  const [currentLead] = React.useState(null);
  const [notes, setNotes] = React.useState('');
  const [myRecs, setMyRecs] = React.useState({ recordings: [] });

  const fetchRecs = async () => setMyRecs(await recordings.myList());

  const startCall = async () => {
    if (!currentLead) return;
    await calls.start(currentLead.id);
  };

  const endCall = async (status) => {
    await calls.end({ status, notes });
    setNotes('');
    await fetchRecs();
  };

  React.useEffect(() => { fetchRecs(); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/logo.png" alt="SoftSynergy" className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">SoftSynergy</h1>
            <p className="text-xs text-orange-500">Cold Call Manager</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 grid gap-4 md:grid-cols-2">
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">Aktualny lead</h2>
          {currentLead ? (
            <div className="space-y-2">
              <div className="text-lg font-medium">{currentLead.name}</div>
              <div className="text-slate-600 text-sm">{currentLead.phone} • {currentLead.email}</div>
              <div className="flex gap-2 pt-2">
                <button className="px-3 py-2 rounded-md bg-blue-600 text-white" onClick={startCall}>Rozpocznij</button>
                <button className="px-3 py-2 rounded-md bg-yellow-600 text-white" onClick={() => endCall('no_answer')}>Nie odebrał</button>
                <button className="px-3 py-2 rounded-md bg-slate-600 text-white" onClick={() => endCall('not_interested')}>Niezainteresowany</button>
                <button className="px-3 py-2 rounded-md bg-purple-600 text-white" onClick={() => endCall('meeting_scheduled')}>Umów spotkanie</button>
              </div>
              <textarea className="w-full mt-2 border rounded-md p-2 text-sm" placeholder="Notatki" value={notes} onChange={e=>setNotes(e.target.value)} />
            </div>
          ) : (
            <div className="text-slate-500">Brak przypisanego leada.</div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Moje nagrania</h2>
            <button className="px-3 py-2 rounded-md text-sm bg-slate-100" onClick={fetchRecs}>Odśwież</button>
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {myRecs.recordings.map(r => (
              <div key={r.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <div className="font-medium">{r.lead?.name || 'Lead'}</div>
                  <div className="text-xs text-slate-500">{new Date(r.startTime).toLocaleString()}</div>
                </div>
                <audio controls className="h-8">
                  <source src={r.recordingUrl} type="audio/webm" />
                </audio>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}



