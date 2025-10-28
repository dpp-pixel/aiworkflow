package dao;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONObject;

import kr.or.kobis.kobisopenapi.consumer.rest.KobisOpenAPIRestService;
import model.Member;
import model.MovieDTO;
import model.MovieDetail;
import model.Review;

public class MovieDAO {
	private static final String USER = "postgres";
	private static final String PASSWORD = "XIMEiolilVXoygG6";
	private static final String URL = "jdbc:postgresql://aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?user=postgres.ctmbvwoxbtuiejrrbgmm&password=XIMEiolilVXoygG6";
	private static final String kobisKey = "041284459e696ebb9079338cd8731f74";
	private static final String kmdbKey = "G8189LMGS734648S7BN3";
	private static final String TMDBKEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxZDhjM2E0OWU0NmNmOGZlZWNiNWE2N2JkN2Q1MThiMyIsIm5iZiI6MTc2MTUzMTcxNS41MTMsInN1YiI6IjY4ZmVkNzQzODJiMDI3Mzc1ODI3NjA4ZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.VGmQp8eGWbTpxdBNjofd0bdgc7t2AA40Go3K16aAq2M";
	private static final String kobisMovieListUrl = "http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json ";
	private static final String kobisMovieDetailUrl = "http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json";

	private Connection con;
	private PreparedStatement pstmt;
	private ResultSet rs;
	private KobisOpenAPIRestService kobis = new KobisOpenAPIRestService(kobisKey);

	public static Connection getConnection() throws SQLException {
		try {
			Class.forName("org.postgresql.Driver");
			return DriverManager.getConnection(URL, USER, PASSWORD);
		} catch (ClassNotFoundException e) {
			throw new SQLException("PostgreSQL JDBC Driver not found", e);
		}
	}

	public MovieDetail getDetail(String input) {
		MovieDetail result = null;
		KmdbApi kmdbapi = new KmdbApi();
		try {
			String urlAddress = kobisMovieDetailUrl;
			//연결 생성
			URL url = new URL(urlAddress);
			HttpURLConnection huc = (HttpURLConnection) url.openConnection();
			huc.setRequestMethod("GET");
			//JSON
			HashMap<String, String> infoMap = new HashMap<>();
			infoMap.put("key", kobisKey);
			infoMap.put("movieCd", input);
			String MovieDetailResponse = kobis.getMovieInfo(true, infoMap);// 영화 상세 json
			result = new MovieDetail();
			ArrayList<String> genreList = new ArrayList<String>();
			//GSON (JSON -> OBJ)
			//			System.out.println(MovieDetailResponse);
			JSONObject root = new JSONObject(MovieDetailResponse).getJSONObject("movieInfoResult").getJSONObject("movieInfo");
			result.setMovieCd(input);//문제 없음
			//			result.setPosterSrc(kmdbapi.getPosterSrc(input));
			result.setMovieNm(root.optString("movieNm"));
			result.setOpenDt(root.optString("openDt"));
			result.setShowTm(root.optString("showTm"));
			//			result.setWatchGradeNm(root.getJSONArray("audits").getJSONObject(0).optString("watchGradeNm", "-"));
			JSONArray auditsArray = root.getJSONArray("audits");
			if (auditsArray.length() > 0) {
				result.setDirectors(auditsArray.getJSONObject(0).optString("watchGradeNm", "-"));
			} else {
				result.setDirectors("-");
			}
			//			result.setDirectors(root.getJSONArray("directors").getJSONObject(0).optString("peopleNm", "-"));//문제 있음
			JSONArray directorsArray = root.getJSONArray("directors");
			if (directorsArray.length() > 0) {
				result.setDirectors(directorsArray.getJSONObject(0).optString("peopleNm", "-"));
			} else {
				result.setDirectors("-");
			}
			JSONArray genreArray = root.getJSONArray("genres");
			for (int i = 0; i < genreArray.length(); i++) {
				genreList.add(genreArray.getJSONObject(i).optString("genreNm", "-"));
			}
			result.setGenreAlt(genreList);

		} catch (Exception e) {
			e.printStackTrace();
		}
		return result;
	}

	public ArrayList<Review> getReviewList(String movieCd) {
		ArrayList<Review> result = new ArrayList<Review>();
		try {
			String sql = "select * from review where moviecode = ?";
			con = getConnection();
			pstmt = con.prepareStatement(sql);
			pstmt.setString(1, movieCd);
			rs = pstmt.executeQuery();
			while (rs.next()) {
				Review temp = new Review();
				temp.setReview_seq(rs.getInt("review_seq"));
				temp.setScore(rs.getString("score"));
				temp.setReview(rs.getString("review"));
				temp.setWriter(rs.getString("writer"));
				temp.setMember_seq(rs.getInt("writer"));
				temp.setMovie_code(movieCd);
				result.add(temp);
			}
			con.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
		return result;
	}

	public void insertReview(Review rev) {
		try {
			String sql = "insert into review values(default,?,?,?,?,default)";
			con = getConnection();
			pstmt = con.prepareStatement(sql);
			pstmt.setInt(1, Integer.valueOf(rev.getScore()));
			pstmt.setString(2, rev.getReview());
			pstmt.setString(3, rev.getMovie_code());
			pstmt.setInt(4, rev.getMember_seq());
			pstmt.executeUpdate();
			con.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public void deleteReview(String reviewid) {
		try {
			String sql = "delete from review where review_seq = ?";
			con = getConnection();
			pstmt = con.prepareStatement(sql);
			pstmt.setInt(1, Integer.valueOf(reviewid));
			pstmt.executeUpdate();
			con.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public String getNickname(int memSeq) {
		String result = "";
		try {
			String sql = "select nickname from member where member_seq = ?";
			con = getConnection();
			pstmt = con.prepareStatement(sql);
			pstmt.setInt(1, memSeq);
			rs = pstmt.executeQuery();
			while (rs.next()) {
				result = rs.getString(1);
			}
			con.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
		return result;
	}

	public String getId(int memSeq) {
		String result = "";
		try {
			String sql = "select id from member where member_seq = ?";
			con = getConnection();
			pstmt = con.prepareStatement(sql);
			pstmt.setInt(1, memSeq);
			rs = pstmt.executeQuery();
			while (rs.next()) {
				result += rs.getString(1);
			}
			con.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
		return result;
	}

	public boolean getMyReviewExist(int memSeq) {
		boolean result = false;
		try {
			String sql = "select count(*) from review where writer= ?";
			con = getConnection();
			pstmt = con.prepareStatement(sql);
			pstmt.setInt(1, memSeq);
			rs = pstmt.executeQuery();
			rs.next();
			if (rs.getInt(1) != 0) {
				result = true;
			} else {
				result = false;
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		return result;
	}

	// 회원가입
	public int insertMember(Member member) {
		int result = 0;
		try {
			con = getConnection();

			String sql = "INSERT INTO member (id, password, email, nickname) VALUES (?, ?, ?, ?)";
			pstmt = con.prepareStatement(sql);
			pstmt.setString(1, member.getId());
			pstmt.setString(2, member.getPw());
			pstmt.setString(3, member.getEmail());
			pstmt.setString(4, member.getNickname());

			result = pstmt.executeUpdate();

		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (pstmt != null)
					pstmt.close();
			} catch (Exception e) {
			}
			try {
				if (con != null)
					con.close();
			} catch (Exception e) {
			}
		}
		return result;
	}

	//로그인
	public Member login(String id, String password) {
		Member member = null;
		String sql = "SELECT * FROM member WHERE id = ? AND password = ?";
		try (Connection con = getConnection(); PreparedStatement pstmt = con.prepareStatement(sql)) {
			pstmt.setString(1, id);
			pstmt.setString(2, password);
			ResultSet rs = pstmt.executeQuery();
			if (rs.next()) {
				member = new Member();
				member.setMember_seq(rs.getInt("member_seq"));
				member.setId(rs.getString("id"));
				member.setPw(rs.getString("password"));
				member.setEmail(rs.getString("email"));
				member.setNickname(rs.getString("nickname"));

			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		return member;
	}

	//회원탈퇴
	public int deleteMember(String id) {
		int result = 0;
		String sql = "DELETE FROM member WHERE id = ?";

		try (Connection con = getConnection(); PreparedStatement pstmt = con.prepareStatement(sql)) {

			pstmt.setString(1, id);
			result = pstmt.executeUpdate();

		} catch (Exception e) {
			e.printStackTrace();
		}

		return result;
	}

	//	public List<MovieDTO> getMovieData(String movieName) {
	//		List<MovieDTO> list = new ArrayList<>();
	//
	//		try {
	//
	//			String urlAddress = kobisMovieListUrl;
	//			//연결 생성
	//			URL url = new URL(urlAddress);
	//			HttpURLConnection huc = (HttpURLConnection) url.openConnection();
	//			huc.setRequestMethod("GET");
	//
	//			HashMap<String, String> infoMap = new HashMap<>();
	//			infoMap.put("key", kobisKey);
	//			infoMap.put("movieNm", movieName);
	//			//			infoMap.put("itemPerPage", "100");
	//			infoMap.put("itemPerPage", "100");
	//			String sb = kobis.getMovieList(true, infoMap);// 영화 상세 json
	//			//			System.out.println("sb : " + sb);
	//			// 🔹 JSON 파싱 (org.json 사용)
	//			JSONObject obj = new JSONObject(sb.toString());
	//			JSONObject result = obj.getJSONObject("movieListResult");
	//			JSONArray movieList = result.getJSONArray("movieList");
	//
	//			for (int i = 0; i < movieList.length(); i++) {
	//				JSONObject movie = movieList.getJSONObject(i);
	//				MovieDTO dto = new MovieDTO();
	//
	//				// 🔸 값이 존재하는지 확인 후 가져오기 (안전 처리)
	//				dto.setMovieCd(movie.optString("movieCd", "정보 없음"));
	//				dto.setMovieNm(movie.optString("movieNm", "정보 없음"));
	//				dto.setPrdtYear(movie.optString("prdtYear", "정보 없음"));
	//				dto.setTypeNm(movie.optString("typeNm", "정보 없음"));
	//				dto.setNationAlt(movie.optString("nationAlt", "정보 없음"));
	//				dto.setGenreAlt(movie.optString("genreAlt", "정보 없음"));
	//
	//				list.add(dto);
	//			}
	//
	//		} catch (Exception e) {
	//			e.printStackTrace();
	//		}
	//
	//		return list;
	//	}
	//=========================================================================================
	//	public List<MovieDTO> getMovieData(String movieName) {
	//		List<MovieDTO> list = new ArrayList<>();
	//
	//		try {
	//			String kobisKey = "041284459e696ebb9079338cd8731f74";
	//			String encodedMovie = URLEncoder.encode(movieName, "UTF-8");
	//
	//			String kobisUrl = "https://kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json" + "?key=" + kobisKey + "&movieNm=" + encodedMovie;
	//
	//			URL url = new URL(kobisUrl);
	//			HttpURLConnection conn = (HttpURLConnection) url.openConnection();
	//			conn.setRequestMethod("GET");
	//
	//			BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
	//			StringBuilder sb = new StringBuilder();
	//			String line;
	//			while ((line = br.readLine()) != null) {
	//				sb.append(line);
	//			}
	//			br.close();
	//
	//			JSONObject obj = new JSONObject(sb.toString());
	//			JSONObject result = obj.getJSONObject("movieListResult");
	//			JSONArray movieList = result.getJSONArray("movieList");
	//
	//			for (int i = 0; i < movieList.length(); i++) {
	//				JSONObject movie = movieList.getJSONObject(i);
	//				MovieDTO dto = new MovieDTO();
	//
	//				dto.setMovieNm(movie.optString("movieNm", "정보 없음"));
	//				dto.setPrdtYear(movie.optString("prdtYear", "정보 없음"));
	//				dto.setTypeNm(movie.optString("typeNm", "정보 없음"));
	//				dto.setNationAlt(movie.optString("nationAlt", "정보 없음"));
	//				dto.setGenreAlt(movie.optString("genreAlt", "정보 없음"));
	//
	//				String kmdbKey = "G8189LMGS734648S7BN3";
	//				String kmdbUrl = "https://api.koreafilm.or.kr/openapi-data2/wisenut/search_api/search_json2.jsp" + "?collection=kmdb_new2" + "&ServiceKey=" + kmdbKey + "&title=" + encodedMovie + "&detail=Y";
	//
	//				try {
	//					URL kmdbApiUrl = new URL(kmdbUrl);
	//					HttpURLConnection kmdbConn = (HttpURLConnection) kmdbApiUrl.openConnection();
	//					kmdbConn.setRequestMethod("GET");
	//
	//					BufferedReader kmdbBr = new BufferedReader(new InputStreamReader(kmdbConn.getInputStream(), "UTF-8"));
	//					StringBuilder kmdbSb = new StringBuilder();
	//					String kmdbLine;
	//					while ((kmdbLine = kmdbBr.readLine()) != null) {
	//						kmdbSb.append(kmdbLine);
	//					}
	//					kmdbBr.close();
	//
	//					JSONObject kmdbObj = new JSONObject(kmdbSb.toString());
	//					JSONArray kmdbData = kmdbObj.optJSONArray("Data");
	//					if (kmdbData != null && kmdbData.length() > 0) {
	//						JSONObject dataObj = kmdbData.getJSONObject(0);
	//						JSONArray resultArr = dataObj.optJSONArray("Result");
	//						if (resultArr != null && resultArr.length() > 0) {
	//							JSONObject movieInfo = resultArr.getJSONObject(0);
	//							String posters = movieInfo.optString("posters", "");
	//							if (!posters.isEmpty()) {
	//								// KMDB 포스터는 '|'로 구분되어 있음
	//								String firstPoster = posters.split("\\|")[0];
	//								dto.setPosterUrl(firstPoster);
	//							} else {
	//								dto.setPosterUrl("https://via.placeholder.com/200x300?text=No+Image");
	//							}
	//						}
	//					}
	//					System.out.println(dto.getPosterUrl());
	//				} catch (Exception e) {
	//					dto.setPosterUrl("https://via.placeholder.com/200x300?text=No+Image");
	//				}
	//
	//				list.add(dto);
	//			}
	//
	//		} catch (Exception e) {
	//			e.printStackTrace();
	//		}
	//
	//		return list;
	//	}

	public List<MovieDTO> getMovieData(String movieName) {
		List<MovieDTO> list = new ArrayList<>();

		try {
			String kobisKey = "041284459e696ebb9079338cd8731f74";
			String encodedSearchName = URLEncoder.encode(movieName, "UTF-8");

			String kobisUrl = "https://kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json" + "?key=" + kobisKey + "&movieNm=" + encodedSearchName;

			URL url = new URL(kobisUrl);
			HttpURLConnection conn = (HttpURLConnection) url.openConnection();
			conn.setRequestMethod("GET");

			BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
			StringBuilder sb = new StringBuilder();
			String line;
			while ((line = br.readLine()) != null) {
				sb.append(line);
			}
			br.close();

			JSONObject obj = new JSONObject(sb.toString());
			JSONObject result = obj.getJSONObject("movieListResult");
			JSONArray movieList = result.getJSONArray("movieList");

			for (int i = 0; i < movieList.length(); i++) {
				JSONObject movie = movieList.getJSONObject(i);
				MovieDTO dto = new MovieDTO();

				dto.setMovieCd(movie.optString("movieCd"));
				dto.setMovieNm(movie.optString("movieNm"));
				dto.setPrdtYear(movie.optString("prdtYear"));
				dto.setTypeNm(movie.optString("typeNm"));
				dto.setNationAlt(movie.optString("nationAlt"));
				dto.setGenreAlt(movie.optString("genreAlt"));

				String encodedTitle = URLEncoder.encode(dto.getMovieNm(), "UTF-8");
				String kmdbKey = "G8189LMGS734648S7BN3";

				String kmdbUrl = "https://api.koreafilm.or.kr/openapi-data2/wisenut/search_api/search_json2.jsp" + "?collection=kmdb_new2" + "&ServiceKey=" + kmdbKey + "&title=" + encodedTitle + "&query=" + encodedTitle + "&detail=Y";

				try {
					URL kmdbApiUrl = new URL(kmdbUrl);
					HttpURLConnection kmdbConn = (HttpURLConnection) kmdbApiUrl.openConnection();
					kmdbConn.setRequestMethod("GET");

					BufferedReader kmdbBr = new BufferedReader(new InputStreamReader(kmdbConn.getInputStream(), "UTF-8"));
					StringBuilder kmdbSb = new StringBuilder();
					String kmdbLine;
					while ((kmdbLine = kmdbBr.readLine()) != null) {
						kmdbSb.append(kmdbLine);
					}
					kmdbBr.close();

					JSONObject kmdbObj = new JSONObject(kmdbSb.toString());
					JSONArray kmdbData = kmdbObj.optJSONArray("Data");
					if (kmdbData != null && kmdbData.length() > 0) {
						JSONObject dataObj = kmdbData.getJSONObject(0);
						JSONArray resultArr = dataObj.optJSONArray("Result");
						if (resultArr != null && resultArr.length() > 0) {
							JSONObject movieInfo = resultArr.getJSONObject(0);
							String posters = movieInfo.optString("posters", "");
							if (!posters.isEmpty()) {
								String firstPoster = posters.split("\\|")[0];
								dto.setPosterUrl(firstPoster);
							} else {
								dto.setPosterUrl("https://via.placeholder.com/200x300?text=No+Image");
							}
						}
					}
				} catch (Exception e) {
					dto.setPosterUrl("https://via.placeholder.com/200x300?text=No+Image");
				}

				list.add(dto);
			}

		} catch (Exception e) {
			e.printStackTrace();
		}

		return list;
	}

	public ArrayList<Review> getMyReviewAll(int memseq) {
		ArrayList<Review> result = new ArrayList<Review>();
		try {
			String sql = "select * from review where writer = ?";
			con = getConnection();
			pstmt = con.prepareStatement(sql);
			pstmt.setInt(1, memseq);
			rs = pstmt.executeQuery();
			while (rs.next()) {
				Review temp = new Review();
				temp.setScore(rs.getString("score"));
				temp.setReview(rs.getString("review"));
				temp.setMovie_code(getMovieName(rs.getString("moviecode")));
				temp.setMember_seq(memseq);
				temp.setWriter(String.valueOf(memseq));
				temp.setReview_seq(rs.getInt("review_seq"));
				result.add(temp);
			}
			con.close();
		} catch (Exception e) {
			e.printStackTrace();
		}
		//		for (int i = 0; i < result.size(); i++) {
		//			System.out.println("result toString : " + result.get(i).toString());
		//		}
		return result;
	}

	public String getMovieName(String movieCd) {
		String result = getDetail(movieCd).getMovieNm();
		return result;
	}

	public boolean isIdExists(String id) {
		boolean exists = false;
		String sql = "SELECT COUNT(*) FROM member WHERE id = ?";
		try {
			con = getConnection();
			pstmt = con.prepareStatement(sql);
			pstmt.setString(1, id);
			rs = pstmt.executeQuery();
			if (rs.next()) {
				exists = rs.getInt(1) > 0;
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (rs != null)
					rs.close();
			} catch (Exception e) {
			}
			try {
				if (pstmt != null)
					pstmt.close();
			} catch (Exception e) {
			}
			try {
				if (con != null)
					con.close();
			} catch (Exception e) {
			}
		}
		return exists;
	}

	// 이메일 중복
	public boolean isEmailExists(String email) {
		boolean exists = false;
		String sql = "SELECT COUNT(*) FROM member WHERE email = ?";
		try {
			con = getConnection();
			pstmt = con.prepareStatement(sql);
			pstmt.setString(1, email);
			rs = pstmt.executeQuery();
			if (rs.next()) {
				exists = rs.getInt(1) > 0;
			}
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {
				if (rs != null)
					rs.close();
			} catch (Exception e) {
			}
			try {
				if (pstmt != null)
					pstmt.close();
			} catch (Exception e) {
			}
			try {
				if (con != null)
					con.close();
			} catch (Exception e) {
			}
		}
		return exists;
	}
}