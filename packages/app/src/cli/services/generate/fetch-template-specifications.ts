import {
  RemoteTemplateSpecification,
  RemoteTemplateSpecificationsQuery,
  RemoteTemplateSpecificationsQuerySchema,
} from '../../api/graphql/template_specifications.js'
import {TemplateSpecification} from '../../models/app/template.js'
import {BaseFunctionConfigurationSchema} from '../../models/extensions/schemas.js'
import {blocks, templates} from '../../constants.js'
import {ExtensionSpecification} from '../../models/extensions/ui.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export async function fetchTemplateSpecifications(token: string): Promise<TemplateSpecification[]> {
  const params: {version?: string} = {version: templates.specification.remoteVersion}
  const result: RemoteTemplateSpecificationsQuerySchema = await partnersRequest(
    RemoteTemplateSpecificationsQuery,
    token,
    params,
  )
  return result.templateSpecifications.map(mapRemoteTemplateSpecification)
}

export function mapRemoteTemplateSpecification(
  remoteTemplateSpecification: RemoteTemplateSpecification,
): TemplateSpecification {
  return {
    identifier: remoteTemplateSpecification.identifier,
    name: remoteTemplateSpecification.name,
    group: remoteTemplateSpecification.group,
    supportLinks: remoteTemplateSpecification.supportLinks,
    types: remoteTemplateSpecification.types.map((extension) => {
      const customSpec: ExtensionSpecification = {
        identifier: 'function',
        additionalIdentifiers: [],
        partnersWebIdentifier: 'function',
        surface: '',
        isPreviewable: false,
        singleEntryPath: true,
        externalIdentifier: remoteTemplateSpecification.identifier,
        externalName: remoteTemplateSpecification.identifier,
        gated: false,
        registrationLimit: blocks.functions.defaultRegistrationLimit,
        supportedFlavors: extension.supportedFlavors,
        group: remoteTemplateSpecification.group,
        category: () => 'function',
        schema: BaseFunctionConfigurationSchema,
        templateURL: extension.url,
        helpURL: remoteTemplateSpecification.supportLinks[0]!,
        templatePath: (lang?: string) => {
          const supportedFlavor = extension.supportedFlavors.find((supportedFlavor) => supportedFlavor.value === flavor)
          if (!supportedFlavor) return undefined
          return supportedFlavor.path
        },
      }
      return customSpec
    }),
  }
}
