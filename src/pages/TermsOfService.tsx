import React from 'react';
import { ScrollText } from 'lucide-react';

const TermsOfService: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 text-gray-300 animate-fade-in relative z-10">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
          <ScrollText size={32} className="text-indigo-400" />
        </div>
        <h1 className="text-4xl font-extrabold text-gradient">Termos de Serviço</h1>
      </div>
      
      <div className="space-y-8 glass-panel p-8 sm:p-10 border border-white/10 animate-slide-up">
        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-indigo-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">1</span>
            Aceitação dos Termos
          </h2>
          <p className="leading-relaxed pl-9">
            Ao acessar e usar este site, você aceita e concorda em estar vinculado pelos termos e disposições deste acordo.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-indigo-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">2</span>
            Uso do Serviço
          </h2>
          <p className="leading-relaxed pl-9">
            Você concorda em usar nossos serviços apenas para fins lícitos e de acordo com as leis aplicáveis.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-indigo-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">3</span>
            Modificações
          </h2>
          <p className="leading-relaxed pl-9">
            Reservamo-nos o direito de modificar estes termos a qualquer momento. Suas alterações entrarão em vigor imediatamente após a publicação.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-indigo-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">4</span>
            Contato
          </h2>
          <p className="leading-relaxed pl-9">
            Se você tiver dúvidas sobre estes termos, entre em contato através de nossa página de contato.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
