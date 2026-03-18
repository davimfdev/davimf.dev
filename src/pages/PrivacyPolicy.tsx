import React from 'react';
import { Shield } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 text-gray-300 animate-fade-in relative z-10">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
          <Shield size={32} className="text-blue-400" />
        </div>
        <h1 className="text-4xl font-extrabold text-gradient">Política de Privacidade</h1>
      </div>
      
      <div className="space-y-8 glass-panel p-8 sm:p-10 border border-white/10 animate-slide-up">
        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-blue-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">1</span>
            Introdução
          </h2>
          <p className="leading-relaxed pl-9">
            Bem-vindo à nossa Política de Privacidade. Sua privacidade é importante para nós. Esta política explica como coletamos, usamos e protegemos suas informações quando você utiliza nosso site.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-blue-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">2</span>
            Coleta de Dados
          </h2>
          <div className="pl-9">
            <p className="leading-relaxed mb-4">
              Nós coletamos apenas as informações estritamente necessárias para o funcionamento dos recursos que você decide utilizar em nosso sistema, como e-mail e dados de sessão de usuário criptografados. Não vendemos ou usamos seus dados para rastreamento de anúncios de terceiros.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-blue-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">3</span>
            Uso dos Dados
          </h2>
          <div className="pl-9">
            <p className="leading-relaxed mb-4">
              Utilizamos suas informações de conta exclusivamente para os seguintes propósitos:
            </p>
            <ul className="space-y-3 bg-white/5 p-4 rounded-lg border border-white/10 text-gray-300">
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 mr-3 flex-shrink-0"></div>
                <span><strong className="text-gray-200">Personalização:</strong> Fornecer painéis de acesso pessoal como a lista de tarefas e gestão financeira.</span>
              </li>
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 mr-3 flex-shrink-0"></div>
                <span><strong className="text-gray-200">Autenticação:</strong> Garantir que você faça login em sua conta com segurança para manter seus dados privados longe de terceiros.</span>
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-blue-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">4</span>
            Compartilhamento de Dados
          </h2>
          <p className="leading-relaxed pl-9">
            Nós não compartilhamos, vendemos ou alugamos suas informações pessoais com terceiros sob nenhuma circunstância.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-blue-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">5</span>
            Segurança
          </h2>
          <p className="leading-relaxed pl-9">
            Tomamos medidas de segurança rigorosas para proteger suas informações. Todos os acessos são feitos através de tokens de autenticação temporários (JWT), que são transmitidos por um canal seguro e validados pelo nosso servidor. Senhas são armazenadas com algoritmos de Hash irreversíveis.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-blue-500 text-white text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">6</span>
            Contato
          </h2>
          <p className="leading-relaxed pl-9">
            Se você tiver alguma dúvida sobre esta Política de Privacidade ou precisar solicitar a exclusão total da sua conta e dados do sistema, entre em contato conosco através da aba de contato disponível no site.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
