import TemplateCombobox from './TemplateCombobox'

interface ServiceNameSelectorProps {
  serviceName: string
  setServiceName: (name: string) => void
  serviceNameTemplates: string[]
  onAddTemplate: (name: string) => void
  onDeleteTemplate: (name: string) => void
  onEnter: () => void
  error?: string
  onClearError?: () => void
}

export default function ServiceNameSelector({
  serviceName,
  setServiceName,
  serviceNameTemplates,
  onAddTemplate,
  onDeleteTemplate,
  onEnter,
  error,
  onClearError,
}: ServiceNameSelectorProps) {
  return (
    <TemplateCombobox
      id="service-name-manual"
      value={serviceName}
      onChange={setServiceName}
      templates={serviceNameTemplates}
      onAddTemplate={onAddTemplate}
      onDeleteTemplate={onDeleteTemplate}
      onEnter={onEnter}
      placeholder="Selecciona o escribe el nombre del culto..."
      error={error}
      onClearError={onClearError}
    />
  )
}
