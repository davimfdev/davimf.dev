import { useState, useMemo } from 'react';
import '../styles/animations.css';

const Roulette = () => {
  const [names, setNames] = useState('');
  const [numberOfWinners, setNumberOfWinners] = useState(1);
  const [winners, setWinners] = useState<string[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  const nameList = useMemo(() => names.split('\n').filter(name => name.trim() !== ''), [names]);
  const segmentAngle = nameList.length > 0 ? 360 / nameList.length : 360;

  const conicGradient = useMemo(() => {
    if (nameList.length === 0) {
      return 'radial-gradient(rgba(74, 85, 104, 0.5), rgba(45, 55, 72, 0.5))';
    }
    const gradientParts = nameList.map((_, index) => {
      const color = index % 2 === 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(147, 51, 234, 0.2)';
      const startAngle = index * segmentAngle;
      const endAngle = (index + 1) * segmentAngle;
      return `${color} ${startAngle}deg ${endAngle}deg`;
    });
    return `conic-gradient(from 90deg, ${gradientParts.join(', ')})`;
  }, [nameList, segmentAngle]);

  const handleSpin = async () => {
    if (nameList.length < 1) return;

    setIsSpinning(true);
    setWinners([]);
    let availableNames = [...nameList];
    const selectedWinners: string[] = [];
    let currentRotation = rotation;

    const spinTo = (targetRotation: number, duration: number) => {
      return new Promise<void>(resolve => {
        const wheel = document.getElementById('roulette-wheel');
        if (wheel) {
          wheel.style.transition = `transform ${duration}ms cubic-bezier(0.3, 1, 0.7, 1)`;
          wheel.style.transform = `rotate(${targetRotation}deg)`;
        }
        setTimeout(resolve, duration);
      });
    };

    for (let i = 0; i < Math.min(numberOfWinners, nameList.length); i++) {
      const winnerIndexInAvailable = Math.floor(Math.random() * availableNames.length);
      const winner = availableNames[winnerIndexInAvailable];
      const winnerIndexInOriginal = nameList.findIndex(name => name === winner);

      const revolutions = 5 * 360;
      const targetSegmentCenterAngle = (winnerIndexInOriginal * segmentAngle) + (segmentAngle / 2);
      const randomOffset = (Math.random() - 0.5) * segmentAngle * 0.8;
      
      const pointerAngle = 360;
      const targetRotation = pointerAngle - targetSegmentCenterAngle - randomOffset;

      const finalRotation = currentRotation - (currentRotation % 360) + revolutions + targetRotation;
      
      const duration = i === 0 ? 5000 : 1500; // Subsequent spins are faster
      await spinTo(finalRotation, duration);
      currentRotation = finalRotation;

      selectedWinners.push(winner);
      setWinners([...selectedWinners]);
      
      availableNames = availableNames.filter(name => name !== winner);

      if (i < Math.min(numberOfWinners, nameList.length) - 1) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Pause between spins is shorter
      }
    }

    setRotation(currentRotation);
    setIsSpinning(false);
  };

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10">
      <h1 className="text-5xl font-extrabold text-center mb-12 text-gradient">Roleta</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1 glass-panel p-8 animate-slide-up">
          <h2 className="text-2xl font-bold mb-6 text-gray-100">Participantes</h2>
          <textarea
            className="w-full h-48 p-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-200 resize-none transition-all placeholder-gray-500"
            placeholder="Digite os nomes, um por linha..."
            value={names}
            onChange={(e) => setNames(e.target.value)}
            disabled={isSpinning}
          />
          <div className="mt-8 flex flex-col space-y-4">
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
              <label htmlFor="numberOfWinners" className="text-lg font-medium text-gray-300">Sortear:</label>
              <div className="flex items-center">
                <input
                  id="numberOfWinners"
                  type="number"
                  min="1"
                  max={nameList.length || 1}
                  className="w-20 p-2 bg-gray-900 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold"
                  value={numberOfWinners}
                  onChange={(e) => setNumberOfWinners(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={isSpinning}
                />
                <span className="ml-3 text-gray-400">nome(s)</span>
              </div>
            </div>
          </div>
          <button
            className={`w-full mt-8 py-4 text-xl font-bold rounded-xl transition-all duration-300 transform ${isSpinning || nameList.length === 0 ? 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/5' : 'btn-primary'}`}
            onClick={handleSpin}
            disabled={isSpinning || nameList.length === 0}
          >
            {isSpinning ? 'Sorteando...' : 'Girar a Roleta'}
          </button>
        </div>

        <div className="lg:col-span-2 flex flex-col items-center justify-center glass-panel p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative w-fit h-fit my-8">
                {/* Pointer */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10" style={{ right: '-10px' }}>
                    <div className="w-0 h-0 filter drop-shadow-lg" style={{
                        borderTop: '15px solid transparent',
                        borderBottom: '15px solid transparent',
                        borderRight: '30px solid #3B82F6',
                    }}></div>
                </div>

                {/* Roulette Container with Border */}
                <div className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px] bg-white/5 rounded-full p-4 border-4 border-white/10 shadow-[0_0_50px_rgba(59,130,246,0.15)]">
                    <div 
                        id="roulette-wheel" 
                        className="relative w-full h-full rounded-full overflow-hidden border-2 border-white/20 shadow-inner"
                        style={{ background: conicGradient, transform: `rotate(${rotation}deg)` }}
                    >
                        {nameList.length > 0 && nameList.map((name, index) => {
                            const angle = (index * segmentAngle) + (segmentAngle / 2);
                            const radius = 0.6;
                            const x = Math.cos(angle * Math.PI / 180) * radius * 50 + 50;
                            const y = Math.sin(angle * Math.PI / 180) * radius * 50 + 50;
                            return (
                                <div 
                                    key={index} 
                                    className="absolute drop-shadow-md"
                                    style={{
                                        left: `${x}%`,
                                        top: `${y}%`,
                                        transform: `translate(-50%, -50%) rotate(${angle}deg)`
                                    }}
                                >
                                    <span className="text-gray-100 font-bold text-center block max-w-[80px] md:max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap text-sm md:text-base">
                                        {name}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
            {winners.length > 0 && !isSpinning && (
                <div className="mt-8 w-full text-center bg-white/5 p-6 rounded-xl border border-white/10 animate-fade-in">
                    <h2 className="text-2xl font-bold mb-4 text-gray-300">Vencedor(es):</h2>
                    <ul className="flex flex-wrap justify-center gap-3">
                    {winners.map((winner, index) => (
                        <li key={index} className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xl font-bold animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                          {winner}
                        </li>
                    ))}
                    </ul>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Roulette;
