import { z, type ZodErrorMap } from 'zod'

const es: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === 'undefined' ? 'Este campo es obligatorio' : 'Valor inválido' }

    case z.ZodIssueCode.too_small: {
      if (issue.type === 'string') {
        return {
          message:
            issue.minimum === 1
              ? 'Este campo es obligatorio'
              : `Mínimo ${issue.minimum} caracteres`,
        }
      }
      if (issue.type === 'array') return { message: `Agrega al menos ${issue.minimum}` }
      return { message: `El mínimo es ${issue.minimum}` }
    }

    case z.ZodIssueCode.too_big: {
      if (issue.type === 'string') return { message: `Máximo ${issue.maximum} caracteres` }
      if (issue.type === 'array') return { message: `Como mucho ${issue.maximum}` }
      return { message: `El máximo es ${issue.maximum}` }
    }

    case z.ZodIssueCode.invalid_string: {
      if (issue.validation === 'email') return { message: 'Ese correo no se ve bien' }
      if (issue.validation === 'url') return { message: 'Esa dirección no se ve bien' }
      if (issue.validation === 'uuid') return { message: 'Identificador inválido' }
      return { message: 'Formato inválido' }
    }

    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Elige una de las opciones' }

    case z.ZodIssueCode.not_multiple_of:
      return { message: `Tiene que ser múltiplo de ${issue.multipleOf}` }

    default:
      return { message: ctx.defaultError }
  }
}

z.setErrorMap(es)
