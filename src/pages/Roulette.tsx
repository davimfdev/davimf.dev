import { useState } from 'react';

const Roulette = () => {
  const [names, setNames] = useState('');
  const [numberOfWinners, setNumberOfWinners] = useState(1);
  const [winners, setWinners] = useState<string[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);

  const handleSpin = () => {
    const nameList = names.split('\n').filter(name => name.trim() !== '');
    if (nameList.length === 0) {
      return;
    }

    setIsSpinning(true);
    setWinners([]);

    setTimeout(() => {
      const shuffled = nameList.sort(() => 0.5 - Math.random());
      const selectedWinners = shuffled.slice(0, Math.min(numberOfWinners, shuffled.length));
      setWinners(selectedWinners);
      setIsSpinning(false);
    }, 3000); // 3 seconds for animation
  };

  return (
    <div className="container mx-auto px-4 py-12 text-center">
      <h1 className="text-4xl font-bold mb-8">Roleta</h1>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <textarea
            className="w-full h-40 p-4 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Digite os nomes, um por linha..."
            value={names}
            onChange={(e) => setNames(e.target.value)}
          />
        </div>
        <div className="mb-6 flex justify-center items-center">
          <label htmlFor="numberOfWinners" className="mr-4 text-lg">Sortear:</label>
          <input
            id="numberOfWinners"
            type="number"
            min="1"
            className="w-24 p-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={numberOfWinners}
            onChange={(e) => setNumberOfWinners(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
           <span className="ml-2 text-lg">nome(s)</span>
        </div>
        <button
          className={`px-8 py-4 text-xl font-bold rounded-lg transition-all duration-300 ${isSpinning ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={handleSpin}
          disabled={isSpinning}
        >
          {isSpinning ? 'Sorteando...' : 'Girar a Roleta'}
        </button>

        {isSpinning && (
          <div className="mt-12">
            <div className="animate-spin-slow border-8 border-t-blue-500 border-gray-700 rounded-full w-32 h-32 mx-auto"></div>
          </div>
        )}

        {winners.length > 0 && !isSpinning && (
          <div className="mt-12">
            <h2 className="text-3xl font-bold mb-4">Vencedor(es):</h2>
            <ul className="text-2xl text-green-400">
              {winners.map((winner, index) => (
                <li key={index}>{winner}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Roulette;