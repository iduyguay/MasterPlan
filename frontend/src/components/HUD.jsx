export function HUD({ progress, fragments, status }) {
  const stages = [1, 2, 3, 4, 5];
  const stageNames = {
    1: 'RECON',
    2: 'ELEVATE',
    3: 'CIPHER',
    4: 'RACE',
    5: 'VAULT'
  };
  return (
    <aside className="hud">
      <div className="hud-block">
        <div className="hud-title">// OPERATION</div>
        <div className="hud-mono">MASTERPLAN</div>
        <div className="hud-sub">{status}</div>
      </div>
      <div className="hud-block">
        <div className="hud-title">// STAGES</div>
        <ul className="stage-list">
          {stages.map(s => {
            const done = progress?.[`stage${s}`] === 1;
            return (
              <li key={s} className={done ? 'done' : 'pending'}>
                <span className="dot"></span>
                <span className="stage-name">[{s}] {stageNames[s]}</span>
                <span className="stage-status">{done ? 'CLEARED' : 'LOCKED'}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="hud-block">
        <div className="hud-title">// FRAGMENTS</div>
        <ul className="frag-list">
          {(fragments || []).length === 0 && <li className="frag-empty">[ bos ]</li>}
          {(fragments || []).map((f, i) => (
            <li key={i} className="frag">{f}</li>
          ))}
        </ul>
      </div>
      <div className="hud-block">
        <div className="hud-title">// COMMANDS</div>
        <ul className="cmd-list">
          <li>help</li>
          <li>scan</li>
          <li>register &lt;user&gt; &lt;pass&gt;</li>
          <li>login &lt;user&gt; &lt;pass&gt;</li>
          <li>stage2</li>
          <li>forge &lt;token&gt;</li>
          <li>elevate &lt;token&gt;</li>
          <li>cipher</li>
          <li>decrypt &lt;text&gt;</li>
          <li>window</li>
          <li>race</li>
          <li>unlock</li>
          <li>status</li>
          <li>clear</li>
          <li>logout</li>
        </ul>
      </div>
    </aside>
  );
}
