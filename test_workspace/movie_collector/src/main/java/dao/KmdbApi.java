package dao;

import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;

public class KmdbApi {
	public String getPosterSrc(String movieCd) {
		String result = "";
		try {
			//요청 할 주소와 키=값
			StringBuilder urlBuilder = new StringBuilder("http://api.koreafilm.or.kr/openapi-data2/wisenut/search_api/search_json2.jsp?collection=kmdb_new2&ServiceKey=G8189LMGS734648S7BN3&movieId=");
			urlBuilder.append(movieCd);
			URL url = new URL(urlBuilder.toString());
			HttpURLConnection conn = (HttpURLConnection) url.openConnection();
			conn.setRequestMethod("GET");
			conn.setRequestProperty("Content-type", "application/json");
			//response -> 바이트스트림임. String 변환 과정 필요함
			BufferedReader rd;
			if (conn.getResponseCode() >= 200 && conn.getResponseCode() <= 300) {
				rd = new BufferedReader(new InputStreamReader(conn.getInputStream()));
			} else {
				rd = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
			}
			StringBuilder sb = new StringBuilder();
			String line;
			while ((line = rd.readLine()) != null) {
				sb.append(line);
			}
			//자원 반환
			rd.close();
			conn.disconnect();
			//src 반환
			System.out.println("sb" + sb.toString());
			JSONObject src = new JSONObject(sb.toString());
			String posterUrl = "";
			result += posterUrl;
		} catch (Exception e) {
			e.printStackTrace();
		}

		return result;
	}
}