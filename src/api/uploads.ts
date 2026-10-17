import { useMutation } from '@tanstack/react-query'
import { UPLOAD_MAX_BYTES, type UploadedFile } from '@marketplace/contracts'
import { api } from './client'

/**
 * Subida de imágenes de producto.
 *
 * El navegador no fija el `Content-Type` del multipart si se lo dejamos a él,
 * y hay que quitarle a axios el `application/json` de la instancia: sin el
 * `boundary` el servidor no puede separar las partes.
 */
export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadedFile> => {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post<UploadedFile>('/uploads', form, {
        headers: { 'Content-Type': undefined },
      })
      return data
    },
  })
}

/** Lo que se puede saber del archivo antes de gastar la subida. */
export function revisarImagen(file: File): string | null {
  if (file.size === 0) return 'El archivo está vacío'
  if (file.size > UPLOAD_MAX_BYTES) {
    return `Pesa ${Math.ceil(file.size / 1024 / 1024)} MB y el límite son ${UPLOAD_MAX_BYTES / 1024 / 1024} MB`
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Solo JPEG, PNG o WebP'
  }
  return null
}
