import { useRouter as useExpoRouter, useLocalSearchParams, useRootNavigationState } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Safe Router Hook - 解决原生 useRouter 的特殊字符编解码问题
 * 
 * 使用方式与原生 useRouter 相同，但会自动处理路径参数中的特殊字符
 */
export function useSafeRouter() {
  const router = useExpoRouter();
  const rootState = useRootNavigationState();

  /**
   * 导航到指定路径，支持传递参数
   * @param path 路径，如 '/detail' 或 '/product'
   * @param params 参数对象，如 { id: 123, name: 'test' }
   */
  const push = useCallback((path: string, params?: Record<string, any>) => {
    if (!rootState?.key) return;
    
    if (params) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
      router.push(`${path}?${queryString}`);
    } else {
      router.push(path);
    }
  }, [router, rootState?.key]);

  /**
   * 替换当前页面
   */
  const replace = useCallback((path: string, params?: Record<string, any>) => {
    if (!rootState?.key) return;
    
    if (params) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
      router.replace(`${path}?${queryString}`);
    } else {
      router.replace(path);
    }
  }, [router, rootState?.key]);

  /**
   * 返回上一页
   */
  const back = useCallback(() => {
    if (!rootState?.key) return;
    router.back();
  }, [router, rootState?.key]);

  /**
   * 智能跳转，如果页面已在栈中则返回，否则推入新页面
   */
  const navigate = useCallback((path: string, params?: Record<string, any>) => {
    if (!rootState?.key) return;
    push(path, params);
  }, [push, rootState?.key]);

  return {
    ...router,
    push,
    replace,
    back,
    navigate,
  };
}

/**
 * Safe Search Params Hook - 安全获取搜索参数
 * 
 * 自动处理参数的解码问题，返回正确类型的参数值
 */
export function useSafeSearchParams<T extends Record<string, any> = {}>() {
  const params = useLocalSearchParams();
  const paramsRef = useRef(params);
  
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  // 解码并转换参数类型
  const decodedParams = {} as T;
  
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      decodedParams[key as keyof T] = undefined as any;
      return;
    }
    
    const decodedValue = decodeURIComponent(String(value));
    
    // 尝试转换为数字
    if (!isNaN(Number(decodedValue)) && decodedValue !== '') {
      decodedParams[key as keyof T] = Number(decodedValue) as any;
    } else {
      decodedParams[key as keyof T] = decodedValue as any;
    }
  });

  return decodedParams;
}

export default useSafeRouter;
