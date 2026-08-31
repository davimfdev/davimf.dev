import React, { useState } from 'react';
import {
  Send,
  Github,
  Linkedin,
  Mail,
  MessageCircle,
  Phone
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Contact = () => {
  const { translations } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch("https://formspree.io/f/meoekelg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      alert("Mensagem enviada com sucesso!");
      setFormData({ name: "", email: "", message: "" });
    } else {
      alert("Erro ao enviar a mensagem.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in relative z-10">
      <h1 className="text-4xl font-bold mb-12 text-gradient inline-block">{translations.contactP}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        <div className="md:col-span-3 glass-panel p-8 animate-slide-up">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2 text-fg-muted">
                {translations.name}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface-1 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none text-fg placeholder-fg-muted"
                placeholder="John Doe"
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-fg-muted">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface-1 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none text-fg placeholder-fg-muted"
                placeholder="john@example.com"
                required
              />
            </div>
            
            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2 text-fg-muted">
                {translations.message}
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={6}
                className="w-full px-4 py-3 bg-surface-1 border border-line rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none text-fg placeholder-fg-muted resize-none"
                placeholder="How can I help you?"
                required
              />
            </div>
            
            <button
              type="submit"
              className="btn-primary w-full sm:w-auto group"
            >
              {translations.sendMessage}
              <Send size={20} className="ml-2 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>
          </form>
        </div>
        
        <div className="md:col-span-2 glass-panel p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-2xl font-semibold mb-8 text-fg">{translations.connect}</h2>
          <div className="space-y-6">
            <a
              href="https://github.com/davimfdev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-fg-muted hover:text-fg group p-3 hover:bg-surface-1 rounded-lg transition-all"
            >
              <div className="p-2 bg-surface-1 rounded-lg mr-4 group-hover:bg-accent-soft/20 group-hover:text-accent transition-colors">
                <Github size={24} />
              </div>
              <span className="font-medium">GitHub</span>
            </a>
            <a
              href="https://www.linkedin.com/in/davimfdev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-fg-muted hover:text-fg group p-3 hover:bg-surface-1 rounded-lg transition-all"
            >
              <div className="p-2 bg-surface-1 rounded-lg mr-4 group-hover:bg-accent-soft/20 group-hover:text-accent transition-colors">
                <Linkedin size={24} />
              </div>
              <span className="font-medium">LinkedIn</span>
            </a>
            <a
              href="mailto:davi@davimf.dev"
              className="flex items-center text-fg-muted hover:text-fg group p-3 hover:bg-surface-1 rounded-lg transition-all"
            >
              <div className="p-2 bg-surface-1 rounded-lg mr-4 group-hover:bg-accent-soft/20 group-hover:text-accent transition-colors">
                <Mail size={24} />
              </div>
              <span className="font-medium truncate">davi@davimf.dev</span>
            </a>
            <a
              href="https://discord.com/users/344214477069221888"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-fg-muted hover:text-fg group p-3 hover:bg-surface-1 rounded-lg transition-all"
            >
              <div className="p-2 bg-surface-1 rounded-lg mr-4 group-hover:bg-accent-soft/20 group-hover:text-accent transition-colors">
                <MessageCircle size={24} />
              </div>
              <span className="font-medium">Discord</span>
            </a>
            <a
                href="https://api.whatsapp.com/send?phone=%205562986089609&text=Ol%C3%A1%2C+vim+do+seu+site."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-fg-muted hover:text-fg group p-3 hover:bg-surface-1 rounded-lg transition-all"
            >
              <div className="p-2 bg-surface-1 rounded-lg mr-4 group-hover:bg-ok/20 group-hover:text-ok transition-colors">
                <Phone size={24} />
              </div>
              <span className="font-medium">WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
