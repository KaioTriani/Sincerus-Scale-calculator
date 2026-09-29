'use client';
import { MessageCircle, ArrowUpRight } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import type { Simulation } from '@/lib/simulation';
import { whatsappURL } from '@/lib/whatsapp';

export function WhatsAppButton({simulation, cashback}:{simulation:Simulation;cashback:number}) {
  return <a className="primary whatsapp-button" href={whatsappURL(BRAND.whatsapp,simulation,cashback)} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Fechar negócio <ArrowUpRight size={18}/></a>;
}
