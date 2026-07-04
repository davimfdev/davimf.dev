import { CollectionEditor } from '../CollectionEditor';
import { useDashboardContext } from '../dashboardContext';

export function ModulesSection() {
  const { data, mutateCollection } = useDashboardContext();
  return (
    <>
      <CollectionEditor title="Categorias de tickets" collection="ticket-categories" items={data.collections.ticketCategories ?? []} fields={[{key:'name',label:'Nome',kind:'string'},{key:'description',label:'Descrição',kind:'string'},{key:'position',label:'Posição',kind:'number'}]} onCreate={(payload) => mutateCollection('ticket-categories','POST',payload)} onUpdate={(id,payload) => mutateCollection('ticket-categories','PATCH',payload,id)} />
      <CollectionEditor title="Itens da loja" collection="shop-items" items={data.collections.shopItems ?? []} fields={[{key:'name',label:'Nome',kind:'string'},{key:'type',label:'Tipo',kind:'string'},{key:'price',label:'Preço',kind:'number'}]} onCreate={(payload) => mutateCollection('shop-items','POST',payload)} onUpdate={(id,payload) => mutateCollection('shop-items','PATCH',payload,id)} onDelete={(id) => mutateCollection('shop-items','DELETE',{},id)} />
    </>
  );
}
