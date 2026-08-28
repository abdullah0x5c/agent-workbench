import '@xyflow/react/dist/style.css'
import './globals.css'

export const metadata = {
  title: 'Agent Workbench',
  description:
    'Wire LLM agents, tools and memory on a canvas, run the graph and watch every reasoning step, tool call and prompt live.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  )
}
