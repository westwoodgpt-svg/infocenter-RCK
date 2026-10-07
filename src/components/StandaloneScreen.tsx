import { AppWindow, LogIn, ServerCrash } from 'lucide-react';

interface Props {
  /** 'session-expired' | 'ticket-invalid' | 'server-unavailable: …' */
  reason: string;
}

// Экран отдельного окна, когда войти нельзя: нет сессии, она истекла, ссылка
// уже использована или сервер не отвечает. Автономного режима с правкой здесь
// нет намеренно — правки ушли бы в никуда.
export default function StandaloneScreen({ reason }: Props) {
  const serverDown = reason.startsWith('server-unavailable');
  const ticketInvalid = reason === 'ticket-invalid';
  const Icon = serverDown ? ServerCrash : LogIn;
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex items-center justify-center p-4 font-sans antialiased">
      <div className="elegant-card rounded-3xl p-8 max-w-lg w-full space-y-4 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Icon className="w-6 h-6 text-indigo-400" />
        </div>
        <h1 className="text-xl font-bold font-display">
          {serverDown ? 'Сервер инфоцентра не отвечает' : ticketInvalid ? 'Ссылка на отдельное окно устарела' : 'Сессия отдельного окна истекла'}
        </h1>
        {serverDown ? (
          <p className="text-sm text-[#a1a1aa] leading-relaxed">
            Обновите страницу через минуту. Если не помогает — сообщите администратору.
            <span className="block text-xs text-[#52525b] mt-2">{reason.replace(/^server-unavailable:\s*/, '')}</span>
          </p>
        ) : (
          <>
            <p className="text-sm text-[#a1a1aa] leading-relaxed">
              {ticketInvalid
                ? 'Ссылка действует 60 секунд и только один раз. '
                : 'Отдельное окно закрывается после 8 часов без работы и в любом случае через сутки после входа. '}
              Откройте инфоцентр из портала Битрикс24 и снова нажмите
            </p>
            <p className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800/60 border border-zinc-700/60 text-zinc-200">
              <AppWindow className="w-3.5 h-3.5 text-indigo-400" /> Открыть в отдельном окне
            </p>
            <p className="text-xs text-[#71717a] leading-relaxed">
              Если вы что-то меняли и не успело сохраниться, правки остались в этом браузере и будут предложены к
              отправке, когда вы снова откроете отдельное окно.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
