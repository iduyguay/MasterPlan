import { useEffect, useRef, useState } from 'react';

export function Terminal({ lines, onCommand, prompt = 'operative@masterplan:~$' }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [hIndex, setHIndex] = useState(-1);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
    const onClick = () => inputRef.current?.focus();
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  function submit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setHistory(h => [...h, input]);
    setHIndex(-1);
    onCommand(input);
    setInput('');
  }

  function onKey(e) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const i = hIndex < 0 ? history.length - 1 : Math.max(0, hIndex - 1);
      setHIndex(i);
      setInput(history[i]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIndex < 0) return;
      const i = hIndex + 1;
      if (i >= history.length) {
        setHIndex(-1);
        setInput('');
      } else {
        setHIndex(i);
        setInput(history[i]);
      }
    }
  }

  return (
    <div className="terminal" ref={scrollRef}>
      {lines.map((l, i) => (
        <pre key={i} className={`line line-${l.kind || 'out'}`}>{l.text}</pre>
      ))}
      <form className="prompt-row" onSubmit={submit}>
        <span className="prompt">{prompt}</span>
        <input
          ref={inputRef}
          autoComplete="off"
          spellCheck="false"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
        />
        <span className="caret"></span>
      </form>
    </div>
  );
}
