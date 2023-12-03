import {ZodSchemaType, BaseConfigType, BaseSchema} from './schemas.js'
import {ExtensionInstance} from './extension-instance.js'
import {blocks} from '../../constants.js'

import {Result} from '@shopify/cli-kit/node/result'
import {capitalize} from '@shopify/cli-kit/common/string'
import {zod} from '@shopify/cli-kit/node/schema'

export type ExtensionFeature =
  | 'ui_preview'
  | 'function'
  | 'theme'
  | 'bundling'
  | 'cart_url'
  | 'esbuild'
  | 'single_js_entry_path'
  | 'app_config'

/**
 * Extension specification with all the needed properties and methods to load an extension.
 */
export interface ExtensionSpecification<TConfiguration extends BaseConfigType = BaseConfigType> {
  identifier: string
  externalIdentifier: string
  externalName: string
  group?: string
  additionalIdentifiers: string[]
  partnersWebIdentifier: string
  surface: string
  registrationLimit: number
  dependency?: string
  graphQLType?: string
  schema: ZodSchemaType<TConfiguration>
  getBundleExtensionStdinContent?: (config: TConfiguration) => string
  deployConfig?: (
    config: TConfiguration,
    directory: string,
    apiKey: string,
    moduleId?: string,
  ) => Promise<{[key: string]: unknown} | undefined>
  validate?: (config: TConfiguration & {path: string}, directory: string) => Promise<Result<unknown, string>>
  preDeployValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
  buildValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
  hasExtensionPointTarget?(config: TConfiguration, target: string): boolean
  appModuleFeatures: (config?: TConfiguration) => ExtensionFeature[]
  transform?: (content: {[key: string]: unknown}) => {[key: string]: unknown}
  reverseTransform?: (content: {[key: string]: unknown}) => {[key: string]: unknown}
}

/**
 * These fields are forbidden when creating a new ExtensionSpec
 * They belong to the ExtensionSpec interface, but the values are obtained from the API
 * and should not be set by us locally
 */
export type ForbiddenFields =
  | 'registrationLimit'
  | 'category'
  | 'externalIdentifier'
  | 'externalName'
  | 'name'
  | 'surface'

/**
 * Partial ExtensionSpec type used when creating a new ExtensionSpec, the only mandatory field is the identifier
 */
export interface CreateExtensionSpecType<TConfiguration extends BaseConfigType = BaseConfigType>
  extends Partial<Omit<ExtensionSpecification<TConfiguration>, ForbiddenFields>> {
  identifier: string
  appModuleFeatures: (config?: TConfiguration) => ExtensionFeature[]
}

/**
 * Create a new ui extension spec.
 *
 * Everything but "identifer" is optional.
 * ```ts
 * identifier: string // unique identifier for the extension type
 * externalIdentifier: string // identifier used externally (default: same as "identifier")
 * partnersWebIdentifier: string // identifier used in the partners web UI (default: same as "identifier")
 * surface?: string // surface where the extension is going to be rendered (default: 'unknown')
 * dependency?: {name: string; version: string} // dependency to be added to the extension's package.json
 * graphQLType?: string // GraphQL type of the extension (default: same as "identifier")
 * schema?: ZodSchemaType<TConfiguration> // schema used to validate the extension's configuration (default: BaseUIExtensionSchema)
 * getBundleExtensionStdinContent?: (configuration: TConfiguration) => string // function to generate the content of the stdin file used to bundle the extension
 * validate?: (configuration: TConfiguration, directory: string) => Promise<Result<undefined, Error>> // function to validate the extension's configuration
 * preDeployValidation?: (configuration: TConfiguration) => Promise<void> // function to validate the extension's configuration before deploying it
 * deployConfig?: (configuration: TConfiguration, directory: string) => Promise<{[key: string]: unknown}> // function to generate the extensions configuration payload to be deployed
 * hasExtensionPointTarget?: (configuration: TConfiguration, target: string) => boolean // function to determine if the extension has a given extension point target
 * ```
 */
export function createExtensionSpecification<TConfiguration extends BaseConfigType = BaseConfigType>(
  spec: CreateExtensionSpecType<TConfiguration>,
): ExtensionSpecification<TConfiguration> {
  const defaults = {
    // these two fields are going to be overridden by the extension specification API response,
    // but we need them to have a default value for tests
    externalIdentifier: `${spec.identifier}_external`,
    additionalIdentifiers: [],
    externalName: capitalize(spec.identifier.replace(/_/g, ' ')),
    surface: 'test-surface',
    partnersWebIdentifier: spec.identifier,
    schema: BaseSchema as ZodSchemaType<TConfiguration>,
    registrationLimit: blocks.extensions.defaultRegistrationLimit,
    transform: spec.transform,
    reverseTransform: spec.reverseTransform,
  }
  return {...defaults, ...spec}
}

export function createConfigExtensionSpecification<TConfiguration extends BaseConfigType = BaseConfigType>(spec: {
  identifier: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: zod.ZodObject<any>
  appModuleFeatures: (config?: TConfiguration) => ExtensionFeature[]
}): ExtensionSpecification<TConfiguration> {
  return createExtensionSpecification({
    identifier: spec.identifier,
    schema: spec.schema as unknown as ZodSchemaType<TConfiguration>,
    appModuleFeatures: spec.appModuleFeatures,
    deployConfig: async (config) => config,
    transform: transformRemoveSection,
    reverseTransform: (content) => defaultReverseTransform(spec.schema, content),
  })
}

function transformRemoveSection(content: {[key: string]: unknown}) {
  const firstKey = Object.keys(content)[0]
  return (firstKey ? content[firstKey] : content) as {[key: string]: unknown}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaultReverseTransform<T>(schema: zod.ZodType<T, any, any>, content: {[key: string]: unknown}) {
  const configSection: {[key: string]: unknown} = {}
  const firstLevelObjectName = Object.keys(schema._def.shape())[0]!
  configSection[firstLevelObjectName] = content
  return configSection
}
