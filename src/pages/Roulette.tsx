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
      return 'radial-gradient(#4A5568, #2D3748)';
    }
    const gradientParts = nameList.map((_, index) => {
      const color = index % 2 === 0 ? '#2D3748' : '#4A5568';
      const startAngle = index * segmentAngle;
      const endAngle = (index + 1) * segmentAngle;
      return `${color} ${startAngle}deg ${endAngle}deg`;
    });
    // The CSS conic-gradient starts at the top (12 o'clock) by default.
    // The trigonometric functions (sin, cos) start from the right (3 o'clock).
    // 'from 90deg' aligns the gradient's start with the math functions, ensuring names are centered in their color segments.
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
      
      // The pointer is at the top. In a coordinate system where 0 is to the right, the top is at 270 degrees.
      const pointerAngle = 270;
      const targetRotation = pointerAngle - targetSegmentCenterAngle - randomOffset;

      const finalRotation = currentRotation - (currentRotation % 360) + revolutions + targetRotation;
      
      const duration = i === 0 ? 5000 : 2000;
      await spinTo(finalRotation, duration);
      currentRotation = finalRotation;

      selectedWinners.push(winner);
      setWinners([...selectedWinners]);
      
      availableNames = availableNames.filter(name => name !== winner);

      if (i < Math.min(numberOfWinners, nameList.length) - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setRotation(currentRotation);
    setIsSpinning(false);
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-8">Roleta</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h2 className="text-2xl font-bold mb-4">Participantes</h2>
          <textarea
            className="w-full h-40 p-4 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Digite os nomes, um por linha..."
            value={names}
            onChange={(e) => setNames(e.target.value)}
            disabled={isSpinning}
          />
          <div className="mt-6 flex items-center">
            <label htmlFor="numberOfWinners" className="mr-4 text-lg">Sortear:</label>
            <input
              id="numberOfWinners"
              type="number"
              min="1"
              max={nameList.length || 1}
              className="w-24 p-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={numberOfWinners}
              onChange={(e) => setNumberOfWinners(Math.max(1, parseInt(e.target.value, 10) || 1))}
              disabled={isSpinning}
            />
            <span className="ml-2 text-lg">nome(s)</span>
          </div>
          <button
            className={`w-full mt-6 px-8 py-4 text-xl font-bold rounded-lg transition-all duration-300 ${isSpinning || nameList.length === 0 ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={handleSpin}
            disabled={isSpinning || nameList.length === 0}
          >
            {isSpinning ? 'Sorteando...' : 'Girar a Roleta'}
          </button>
        </div>

        <div className="md:col-span-2 flex flex-col items-center relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10" style={{top: '-8px'}}>
                <div className="w-0 h-0" style={{
                    borderLeft: '10px solid transparent',
                    borderRight: '10px solid transparent',
                    borderTop: '20px solid #EF4444',
                }}></div>
            </div>
            <div className="relative w-96 h-96">
                <div 
                    id="roulette-wheel" 
                    className="relative w-full h-full rounded-full overflow-hidden"
                    style={{ background: conicGradient, transform: `rotate(${rotation}deg)` }}
                >
                    {nameList.length > 0 && nameList.map((name, index) => {
                        const angle = (index * segmentAngle) + (segmentAngle / 2);
                        const radius = 0.6; // 60% of radius
                        const x = Math.cos(angle * Math.PI / 180) * radius * 50 + 50;
                        const y = Math.sin(angle * Math.PI / 180) * radius * 50 + 50;
                        return (
                            <div 
                                key={index} 
                                className="absolute"
                                style={{
                                    left: `${x}%`,
                                    top: `${y}%`,
                                    transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`
                                }}
                            >
                                <span className="text-white font-bold text-center block max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">
                                    {name}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
            {winners.length > 0 && !isSpinning && (
                <div className="mt-8 w-full text-center">
                    <h2 className="text-3xl font-bold mb-4">Sorteado(s):</h2>
                    <ul className="text-2xl text-green-400">
                    {winners.map((winner, index) => (
                        <li key={index} className="fade-in">{winner}</li>
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