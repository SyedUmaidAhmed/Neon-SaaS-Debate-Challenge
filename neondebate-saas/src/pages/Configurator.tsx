import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { NeonButton } from '../components/NeonButton';
import { DebateConfig } from '../types';
import { trackEvent } from '../lib/posthog';

export function Configurator() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('Current State of AI and Humanity');
  const [rounds, setRounds] = useState(3);
  
  const [agent1Name, setAgent1Name] = useState('Alpha');
  const [agent1Persona, setAgent1Persona] = useState('You are an optimistic AI, focusing on the potential for technological utopianism and how AI augments humanity.');
  
  const [agent2Name, setAgent2Name] = useState('Omega');
  const [agent2Persona, setAgent2Persona] = useState('You are a cautious and cynical AI, arguing about alignment risks, job displacement, and the existential threat of AI.');

  const handleStart = () => {
    const config: DebateConfig = {
      topic,
      rounds,
      agent1: { id: uuidv4(), name: agent1Name, persona: agent1Persona, color: 'blue' },
      agent2: { id: uuidv4(), name: agent2Name, persona: agent2Persona, color: 'pink' }
    };
    
    trackEvent('debate_configured', { topic, rounds });
    
    // Pass state via React Router
    navigate('/debate', { state: { config } });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 w-full h-full overflow-y-auto">
      <h1 className="text-3xl font-extrabold text-center mb-10 text-glass-blue tracking-[2px] uppercase">
        Debate Configurator
      </h1>

      <div className="space-y-6 glass-panel p-8">
        <section>
          <label className="block text-[11px] font-bold tracking-[2px] uppercase text-glass-blue mb-2 pb-1 border-b border-white/10">Debate Topic</label>
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-main focus:outline-none focus:border-glass-blue focus:ring-1 focus:ring-glass-blue"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </section>

        <section>
          <label className="block text-[11px] font-bold tracking-[2px] uppercase text-glass-blue mb-2 pb-1 border-b border-white/10">Number of Rounds</label>
          <input 
            type="number"
            min={1} max={10}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-text-main focus:outline-none focus:border-glass-blue focus:ring-1 focus:ring-glass-blue"
            value={rounds === 0 ? '' : rounds}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setRounds(isNaN(val) ? 0 : val);
            }}
          />
        </section>

        <div className="grid md:grid-cols-2 gap-6 pt-4">
          {/* Agent 1 */}
          <section className="glass-panel glass-panel-light p-5">
            <h3 className="text-sm font-semibold tracking-[1px] text-glass-blue uppercase mb-4 flex gap-2">Agent 1 <span className="opacity-50">(Blue)</span></h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-text-dim mb-1">Name</label>
                <input 
                  className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-text-main focus:outline-none focus:border-glass-blue"
                  value={agent1Name}
                  onChange={(e) => setAgent1Name(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-text-dim mb-1">Persona</label>
                <textarea 
                  className="w-full h-32 bg-black/20 border border-white/5 rounded-lg p-2 text-text-main focus:outline-none focus:border-glass-blue text-sm"
                  value={agent1Persona}
                  onChange={(e) => setAgent1Persona(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Agent 2 */}
          <section className="glass-panel glass-panel-light p-5">
            <h3 className="text-sm font-semibold tracking-[1px] text-glass-pink uppercase mb-4 flex gap-2">Agent 2 <span className="opacity-50">(Pink)</span></h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-text-dim mb-1">Name</label>
                <input 
                  className="w-full bg-black/20 border border-white/5 rounded-lg p-2 text-text-main focus:outline-none focus:border-glass-pink"
                  value={agent2Name}
                  onChange={(e) => setAgent2Name(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-text-dim mb-1">Persona</label>
                <textarea 
                  className="w-full h-32 bg-black/20 border border-white/5 rounded-lg p-2 text-text-main focus:outline-none focus:border-glass-pink text-sm"
                  value={agent2Persona}
                  onChange={(e) => setAgent2Persona(e.target.value)}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-center pt-8">
          <NeonButton onClick={handleStart} color="green" className="text-[14px] px-12 py-3 rounded-xl border-2">
            Initialize Debate
          </NeonButton>
        </div>
      </div>
    </div>
  );
}
