import React, { useState, useEffect } from 'react';
import { X, Copy, RefreshCw, Check, Lock } from 'lucide-react';

const PasswordGenerator = ({ onClose }) => {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(20);
  const [options, setOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true
  });
  const [copied, setCopied] = useState(false);

  const generatePassword = () => {
    const charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
    };

    let availableChars = '';
    if (options.uppercase) availableChars += charset.uppercase;
    if (options.lowercase) availableChars += charset.lowercase;
    if (options.numbers) availableChars += charset.numbers;
    if (options.symbols) availableChars += charset.symbols;

    if (!availableChars) {
      setPassword('');
      return;
    }

    let generated = '';
    for (let i = 0; i < length; i++) {
      generated += availableChars.charAt(Math.floor(Math.random() * availableChars.length));
    }
    setPassword(generated);
    setCopied(false);
  };

  useEffect(() => {
    generatePassword();
  }, [length, options]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStrength = () => {
    let score = 0;
    if (length > 14) score++;
    if (length > 24) score++;
    if (options.uppercase && options.lowercase) score++;
    if (options.numbers) score++;
    if (options.symbols) score++;
    
    if (score <= 2) return { label: 'Insegura', color: 'var(--error)', width: '33%' };
    if (score <= 4) return { label: 'Moderada', color: 'var(--primary)', width: '66%' };
    return { label: 'Impenetrable', color: 'var(--success)', width: '100%' };
  };

  const strength = getStrength();

  return (
    <>
      <button onClick={onClose} className="modal-close btn-icon">
        <X size={24} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--primary)', padding: '0.75rem', borderRadius: '12px', color: '#000' }}>
          <Lock size={32} />
        </div>
        <div>
          <h2>Generador Seguro</h2>
          <p className="text-small">Crea claves con alta entropía.</p>
        </div>
      </div>

      <div style={{ 
        background: 'rgba(0,0,0,0.05)', 
        border: '1px solid rgba(0,0,0,0.1)', 
        padding: '1.5rem', 
        borderRadius: '16px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '2rem',
        wordBreak: 'break-all'
      }}>
        <span className="font-mono text-primary" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
          {password || '...' }
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginLeft: '1rem' }}>
          <button onClick={generatePassword} className="btn-icon">
            <RefreshCw size={20} />
          </button>
          <button onClick={copyToClipboard} className="btn-icon" style={copied ? { color: 'var(--success)' } : {}}>
            {copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span className="text-small font-bold text-uppercase">Complejidad: {length} char</span>
            <span className="text-small font-bold text-uppercase" style={{ color: strength.color }}>
              Nivel: {strength.label}
            </span>
          </div>
          <div style={{ height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '1rem' }}>
             <div style={{ height: '100%', width: strength.width, backgroundColor: strength.color, transition: 'all 0.5s ease-out' }} />
          </div>
          <input 
            type="range" 
            min="8" 
            max="64" 
            value={length} 
            onChange={(e) => setLength(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {Object.entries({
            uppercase: 'Mayúsculas',
            lowercase: 'Minúsculas',
            numbers: 'Números',
            symbols: 'Símbolos'
          }).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'rgba(0,0,0,0.03)', padding: '1rem', borderRadius: '12px' }}>
              <input 
                type="checkbox" 
                checked={options[key]}
                onChange={() => setOptions({...options, [key]: !options[key]})}
                style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{label}</span>
            </label>
          ))}
        </div>

        <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
          Listo
        </button>
      </div>
    </>
  );
};

export default PasswordGenerator;
