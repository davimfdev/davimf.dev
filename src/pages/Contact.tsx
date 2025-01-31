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
    // Handle form submission
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
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">{translations.contactP}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                {translations.name}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2">
                {translations.message}
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={6}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <button
              type="submit"
              className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {translations.sendMessage}
              <Send size={20} className="ml-2" />
            </button>
          </form>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">{translations.connect}</h2>
          <div className="space-y-4">
            <a
              href="https://github.com/D4emonF"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <Github className="mr-3" size={24} />
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/davi-fonseca-345b14148/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <Linkedin className="mr-3" size={24} />
              LinkedIn
            </a>
            <a
              href="mailto:davimf9702@gmail.com"
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <Mail className="mr-3" size={24} />
              davimf9702@gmail.com
            </a>
            <a
              href="https://discord.com/users/344214477069221888"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <MessageCircle className="mr-3" size={24} />
              Discord
            </a>
            <a
                href="https://api.whatsapp.com/send?phone=%205562986089609&text=Ol%C3%A1%2C+vim+do+seu+site."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <Phone className="mr-3" size={24} />
              +55 62 98608-9609
            </a>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;